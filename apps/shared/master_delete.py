from __future__ import annotations

from typing import Any

LINK_SAMPLE_LIMIT = 100


def staff_display_name(staff) -> str:
    parts = f"{(staff.first_name or '').strip()} {(staff.last_name or '').strip()}".strip()
    if staff.user_id and getattr(staff.user, "email", None):
        parts = parts or str(staff.user.email)
    return parts or (staff.employee_code or "").strip() or str(staff.id)


def build_linked_staff(staff_qs) -> tuple[list[dict[str, Any]], int]:
    staff_count = staff_qs.count()
    staff_rows = list(staff_qs.select_related("user").order_by("employee_code", "first_name")[:LINK_SAMPLE_LIMIT])
    linked_staff = [
        {
            "id": str(s.id),
            "name": staff_display_name(s),
            "employee_code": (s.employee_code or "").strip() or None,
        }
        for s in staff_rows
    ]
    return linked_staff, staff_count


def build_linked_doctors(doctors_qs) -> tuple[list[dict[str, Any]], int]:
    doctors_count = doctors_qs.count()
    doctor_rows = list(doctors_qs.order_by("name")[:LINK_SAMPLE_LIMIT])
    linked_doctors = [
        {
            "id": str(d.id),
            "name": d.name,
            "doctor_code": (d.doctor_code or "").strip() or None,
        }
        for d in doctor_rows
    ]
    return linked_doctors, doctors_count


def build_linked_specialties(specialties_qs) -> tuple[list[dict[str, Any]], int]:
    specialties_count = specialties_qs.count()
    spec_rows = list(specialties_qs.order_by("name")[:LINK_SAMPLE_LIMIT])
    linked_specialties = [{"id": str(sp.id), "name": sp.name, "code": sp.code} for sp in spec_rows]
    return linked_specialties, specialties_count


def operational_staff_for_department(department):
    return department.staff.filter(is_deleted=False)


def operational_doctors_for_department(department):
    from apps.doctors.models import DoctorProfile

    return DoctorProfile.objects.filter(departments=department, is_deleted=False)


def operational_specialties_for_department(department):
    return department.specialties.filter(is_deleted=False)


def operational_staff_for_designation(designation):
    return designation.staff.filter(is_deleted=False)


def operational_doctors_for_specialty(specialty):
    from apps.doctors.models import DoctorProfile

    return DoctorProfile.objects.filter(specialty=specialty, is_deleted=False)
