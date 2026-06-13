from __future__ import annotations

from django.utils import timezone

from apps.doctors.models import DoctorProfile
from apps.ipd.models import IPDAdmission


def resolve_ipd_doctor_name(*, assigned_doctor=None, hospital_id=None) -> str:
    """Return IPD doctor name from the linked profile, including archived or inactive profiles."""
    if not assigned_doctor or not hospital_id:
        return ""

    profile_name = (
        DoctorProfile.all_objects.filter(
            hospital_id=hospital_id,
            user_id=getattr(assigned_doctor, "id", None),
        )
        .order_by("-updated_at")
        .values_list("name", flat=True)
        .first()
        or ""
    )
    return profile_name.strip()


def ipd_calendar_stay_days(admission: IPDAdmission) -> int:
    """Stay days from admission dates only (ignores manual days override)."""
    if (
        admission.status in (IPDAdmission.Status.DISCHARGED, IPDAdmission.Status.CANCELLED)
        and admission.discharged_at
    ):
        return max(1, (admission.discharged_at.date() - admission.admission_date).days)
    return max(1, (timezone.now().date() - admission.admission_date).days)


def ipd_stay_days(admission: IPDAdmission) -> int:
    """Stay days for room rent: manual override when set, else admission span."""
    override = getattr(admission, "room_rent_days_override", None)
    if override is not None:
        try:
            days = int(override)
            if days >= 1:
                return days
        except (TypeError, ValueError):
            pass
    return ipd_calendar_stay_days(admission)

