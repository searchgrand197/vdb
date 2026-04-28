from __future__ import annotations

from apps.doctors.models import DoctorProfile


def resolve_opd_doctor_name(*, doctor_user=None, hospital_id=None) -> str:
    """
    Return a consistent display name for OPD doctor surfaces.

    Priority:
    1) DoctorProfile.name for this user within hospital
    2) User full_name
    3) User first_name + last_name
    4) User email
    """
    if not doctor_user:
        return ""

    profile_name = ""
    if hospital_id:
        profile_name = (
            DoctorProfile.objects.filter(
                hospital_id=hospital_id,
                user_id=getattr(doctor_user, "id", None),
                is_deleted=False,
            )
            .values_list("name", flat=True)
            .first()
            or ""
        )
    if profile_name.strip():
        return profile_name.strip()

    full_name = (getattr(doctor_user, "full_name", "") or "").strip()
    if full_name:
        return full_name

    first = (getattr(doctor_user, "first_name", "") or "").strip()
    last = (getattr(doctor_user, "last_name", "") or "").strip()
    fallback_name = f"{first} {last}".strip()
    if fallback_name:
        return fallback_name

    return (getattr(doctor_user, "email", "") or "").strip()

