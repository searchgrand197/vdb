from __future__ import annotations

from apps.doctors.models import DoctorProfile


def resolve_ipd_doctor_name(*, assigned_doctor=None, hospital_id=None) -> str:
    """Return IPD doctor name strictly from active DoctorProfile mapping."""
    if not assigned_doctor or not hospital_id:
        return ""

    profile_name = (
        DoctorProfile.objects.filter(
            hospital_id=hospital_id,
            user_id=getattr(assigned_doctor, "id", None),
            is_deleted=False,
            is_active=True,
        )
        .values_list("name", flat=True)
        .first()
        or ""
    )
    return profile_name.strip()

