"""Resolve and apply doctor vs hospital (Self) collection attribution."""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model

from apps.billing.models import BillingInvoice, CollectionAttribution
from apps.doctors.models import DoctorProfile
from apps.ipd.services import resolve_ipd_doctor_name
from apps.opd.services import resolve_opd_doctor_name
from apps.payments.models import PaymentTransaction

User = get_user_model()


def resolve_attribution(
    *,
    opd_visit=None,
    ipd_admission=None,
    requested_type: str | None = None,
    requested_doctor_user=None,
) -> tuple[str, Any | None]:
    """
    Encounter doctor wins over manual selection.
    Returns (attribution_type, attributed_doctor_user or None).
    """
    if opd_visit is not None and getattr(opd_visit, "doctor_user_id", None):
        return CollectionAttribution.DOCTOR, opd_visit.doctor_user
    if ipd_admission is not None and getattr(ipd_admission, "assigned_doctor_id", None):
        return CollectionAttribution.DOCTOR, ipd_admission.assigned_doctor

    req_type = str(requested_type or CollectionAttribution.HOSPITAL_SELF).strip()
    if req_type == CollectionAttribution.DOCTOR and requested_doctor_user is not None:
        return CollectionAttribution.DOCTOR, requested_doctor_user
    return CollectionAttribution.HOSPITAL_SELF, None


def attribution_kwargs(
    *,
    opd_visit=None,
    ipd_admission=None,
    requested_type: str | None = None,
    requested_doctor_user=None,
) -> dict[str, Any]:
    attr_type, doctor = resolve_attribution(
        opd_visit=opd_visit,
        ipd_admission=ipd_admission,
        requested_type=requested_type,
        requested_doctor_user=requested_doctor_user,
    )
    return {
        "attribution_type": attr_type,
        "attributed_doctor_user": doctor,
    }


def apply_attribution_to_invoice(
    invoice: BillingInvoice,
    *,
    opd_visit=None,
    ipd_admission=None,
    requested_type: str | None = None,
    requested_doctor_user=None,
    save: bool = True,
) -> BillingInvoice:
    visit = opd_visit if opd_visit is not None else getattr(invoice, "opd_visit", None)
    admission = ipd_admission if ipd_admission is not None else getattr(invoice, "ipd_admission", None)
    kwargs = attribution_kwargs(
        opd_visit=visit,
        ipd_admission=admission,
        requested_type=requested_type,
        requested_doctor_user=requested_doctor_user,
    )
    invoice.attribution_type = kwargs["attribution_type"]
    invoice.attributed_doctor_user = kwargs["attributed_doctor_user"]
    if save:
        invoice.save(update_fields=["attribution_type", "attributed_doctor_user", "updated_at"])
    return invoice


def apply_attribution_to_payment(payment: PaymentTransaction, invoice: BillingInvoice | None = None) -> PaymentTransaction:
    inv = invoice or payment.invoice
    payment.attribution_type = inv.attribution_type
    payment.attributed_doctor_user_id = inv.attributed_doctor_user_id
    return payment


def resolve_attributed_doctor_display(*, hospital_id, attribution_type: str, doctor_user=None) -> str:
    if attribution_type != CollectionAttribution.DOCTOR or not doctor_user:
        return "Self (Hospital)"
    name = resolve_opd_doctor_name(doctor_user=doctor_user, hospital_id=hospital_id)
    if not name:
        name = resolve_ipd_doctor_name(assigned_doctor=doctor_user, hospital_id=hospital_id)
    if name:
        return name
    full = f"{getattr(doctor_user, 'first_name', '')} {getattr(doctor_user, 'last_name', '')}".strip()
    return full or getattr(doctor_user, "email", "") or "Doctor"


def doctor_name_map(hospital_id, user_ids: set) -> dict[str, str]:
    ids = {uid for uid in user_ids if uid}
    if not ids:
        return {}
    profiles = DoctorProfile.all_objects.filter(hospital_id=hospital_id, user_id__in=ids).values("user_id", "name")
    out = {str(row["user_id"]): str(row["name"]).strip() for row in profiles if row.get("name")}
    for uid in ids:
        key = str(uid)
        if key not in out:
            try:
                user = User.objects.only("id", "first_name", "last_name", "email").get(id=uid)
            except User.DoesNotExist:
                out[key] = "Doctor"
            else:
                full = f"{user.first_name or ''} {user.last_name or ''}".strip()
                out[key] = full or user.email or "Doctor"
    return out
