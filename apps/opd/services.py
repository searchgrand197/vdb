from __future__ import annotations

from apps.doctors.models import DoctorProfile


def resolve_opd_doctor_name(*, doctor_user=None, hospital_id=None) -> str:
    """
    Return doctor name from the linked profile, including archived or inactive profiles.
    """
    if not doctor_user or not hospital_id:
        return ""

    profile_name = (
        DoctorProfile.all_objects.filter(
            hospital_id=hospital_id,
            user_id=getattr(doctor_user, "id", None),
        )
        .order_by("-updated_at")
        .values_list("name", flat=True)
        .first()
        or ""
    )
    return profile_name.strip()

