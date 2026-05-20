"""SMS with a short public URL to view/print a payment slip."""

from __future__ import annotations

import logging

from django.conf import settings
from django.urls import reverse
from django.utils import timezone

from apps.opd.sms_utils import resolve_patient_sms_phone, send_twilio_sms
from apps.payments.models import PaymentTransaction

logger = logging.getLogger(__name__)


def build_payment_slip_public_url(payment: PaymentTransaction) -> str:
    if not payment.public_slip_code:
        payment.save(update_fields=["public_slip_code", "updated_at"])
    path = reverse("payment-slip-short", kwargs={"code": payment.public_slip_code})
    base = getattr(settings, "SITE_BASE_URL", "https://app.vardaanhospitaljind.com").rstrip("/")
    return f"{base}{path}"


def build_payment_slip_sms_body(*, patient_name: str, paid_date: str, amount: str, url: str) -> str:
    display_name = (patient_name or "Patient").strip().split()[0] or "Patient"
    return (
        f"Dear {display_name},\n"
        "Your payment slip is generated\n"
        f"{paid_date}\n"
        f"₹{amount}\n"
        f"{url}"
    )


def send_payment_slip_link_sms(payment_or_id) -> str | None:
    """
    Send payment slip SMS with date, amount, and short URL.
    Does not raise — payment creation must not fail if SMS fails.
    """
    try:
        if isinstance(payment_or_id, PaymentTransaction):
            payment = PaymentTransaction.objects.select_related(
                "invoice__patient", "invoice__patient__guardian"
            ).get(pk=payment_or_id.pk)
        else:
            payment = PaymentTransaction.objects.select_related(
                "invoice__patient", "invoice__patient__guardian"
            ).get(pk=payment_or_id)
    except PaymentTransaction.DoesNotExist:
        logger.warning("Payment %s not found for slip SMS", payment_or_id)
        return None

    if payment.is_deleted:
        return None

    patient = payment.invoice.patient
    to_number = resolve_patient_sms_phone(patient)
    if not to_number:
        logger.warning("No valid phone for payment slip SMS (payment=%s)", payment.id)
        return None

    patient_name = f"{patient.first_name or ''} {patient.last_name or ''}".strip() or patient.uhid
    paid_at = payment.paid_at or timezone.now()
    if timezone.is_aware(paid_at):
        paid_at = timezone.localtime(paid_at)
    paid_date = paid_at.strftime("%d/%m/%Y")
    amount = f"{payment.amount:.2f}"

    url = build_payment_slip_public_url(payment)
    body = build_payment_slip_sms_body(
        patient_name=patient_name,
        paid_date=paid_date,
        amount=amount,
        url=url,
    )
    sid = send_twilio_sms(to_number=to_number, body=body)
    if sid:
        logger.info("Payment slip SMS sent payment=%s to=%s", payment.id, to_number)
    return sid
