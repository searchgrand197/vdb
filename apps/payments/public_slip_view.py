"""Public payment slip page — short link or signed token, view/print/download."""

from __future__ import annotations

from decimal import Decimal

from django.core import signing
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.views import View

from apps.payments.models import PaymentTransaction
from apps.payments.slip_tokens import load_payment_slip_token
from apps.settings_management.models import ReceptionPortalSettings


def _money(value) -> str:
    return f"{Decimal(str(value or 0)):.2f}"


def _payment_mode_label(mode: str) -> str:
    labels = {
        "cash": "Cash",
        "card": "Card",
        "upi": "UPI",
        "bank_transfer": "Bank Transfer",
        "other": "Other",
    }
    return labels.get(mode or "", (mode or "—").title())


def _render_payment_slip_html(payment: PaymentTransaction, request) -> str:
    invoice = payment.invoice
    patient = invoice.patient
    patient_name = f"{patient.first_name or ''} {patient.last_name or ''}".strip() or patient.uhid

    portal, _ = ReceptionPortalSettings.objects.get_or_create(
        hospital_id=payment.hospital_id,
        defaults={"default_city": "Jind", "default_state": "Haryana"},
    )
    hospital_name = portal.hospital_name or payment.hospital.name or "Hospital"

    items = list(invoice.items.all().order_by("created_at"))
    if payment.status == PaymentTransaction.Status.PENDING:
        pay_label = "Credit / Due"
    else:
        pay_label = _payment_mode_label(payment.payment_mode)

    return render_to_string(
        "payments/public_slip.html",
        {
            "hospital_name": hospital_name,
            "address": portal.address,
            "pin_code": portal.pin_code,
            "phone": portal.phone,
            "email": portal.email,
            "website": portal.website,
            "slip_number": payment.slip_number or "—",
            "invoice_no": invoice.invoice_no,
            "patient_name": patient_name,
            "patient_uhid": patient.uhid,
            "patient_phone": patient.phone,
            "paid_at": payment.paid_at,
            "payment_mode": pay_label,
            "amount": _money(payment.amount),
            "subtotal": _money(invoice.subtotal_amount),
            "discount": _money(invoice.discount_amount),
            "total": _money(invoice.total_amount),
            "items": items,
            "transaction_reference": payment.transaction_reference or "",
        },
        request=request,
    )


def _payment_queryset():
    return PaymentTransaction.objects.select_related(
        "invoice",
        "invoice__patient",
        "hospital",
        "collected_by",
    ).prefetch_related("invoice__items")


class PaymentSlipShortView(View):
    """Short public link: /p/{8-char-code}/"""

    def get(self, request, code: str):
        payment = get_object_or_404(_payment_queryset(), public_slip_code=code, is_deleted=False)
        return HttpResponse(_render_payment_slip_html(payment, request))


class PaymentSlipPublicView(View):
    """Legacy signed-token link (older SMS messages)."""

    def get(self, request, token: str):
        try:
            payload = load_payment_slip_token(token)
        except signing.BadSignature:
            return HttpResponse("Invalid or expired link.", status=400, content_type="text/plain")
        except signing.SignatureExpired:
            return HttpResponse("This link has expired.", status=410, content_type="text/plain")

        payment = get_object_or_404(_payment_queryset(), pk=payload["payment_id"], is_deleted=False)
        return HttpResponse(_render_payment_slip_html(payment, request))
