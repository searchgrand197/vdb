"""
Resolve login portal access from staff designation portal allowlists.
"""

from __future__ import annotations

from apps.roles_permissions.portal_registry import ALL_PORTAL_CODES
from apps.staff.models import StaffProfile


def allowed_pharmacies_for_user(user) -> list[str]:
    """
    Pharmacy branch UUIDs the user may access.

    Empty list means no restriction (all active branches allowed).
    Superusers always return [] (unrestricted).
    """
    if getattr(user, "is_superuser", False):
        return []

    ids: set[str] = set()
    staff_qs = StaffProfile.objects.filter(user_id=user.id, is_deleted=False).select_related(
        "designation"
    ).prefetch_related("allowed_pharmacies", "designation__allowed_pharmacies")
    for staff in staff_qs:
        staff_pharmacies = staff.allowed_pharmacies.filter(is_active=True)
        if staff_pharmacies.exists():
            for pharmacy in staff_pharmacies:
                ids.add(str(pharmacy.id))
            continue

        designation = staff.designation
        if designation is None:
            continue
        designation_pharmacies = designation.allowed_pharmacies.filter(is_active=True)
        if not designation_pharmacies.exists():
            return []
        for pharmacy in designation_pharmacies:
            ids.add(str(pharmacy.id))

    return sorted(ids)


def user_may_access_pharmacy(user, pharmacy_id) -> bool:
    """Return True if user may use this pharmacy branch (or has no restriction)."""
    if getattr(user, "is_superuser", False):
        return True
    allowed = allowed_pharmacies_for_user(user)
    if not allowed:
        return True
    return str(pharmacy_id) in allowed


def allowed_portals_for_user(user) -> list[str]:
    if getattr(user, "is_superuser", False):
        return list(ALL_PORTAL_CODES)

    portals: set[str] = set()
    staff_qs = StaffProfile.objects.filter(user_id=user.id, is_deleted=False).select_related("designation")
    for staff in staff_qs:
        designation = staff.designation
        if designation is None:
            continue
        for portal_code in designation.allowed_portals or []:
            if portal_code in ALL_PORTAL_CODES:
                portals.add(portal_code)

    return sorted(portals)


def auth_session_payload_for_user(user) -> dict:
    return {
        "allowed_portals": allowed_portals_for_user(user),
        "allowed_pharmacy_ids": allowed_pharmacies_for_user(user),
    }


def permission_codes_for_user(user) -> list[str]:
    """Legacy helper for attendance scoping; module RBAC is disabled for now."""
    if getattr(user, "is_superuser", False):
        from apps.roles_permissions.models import Permission

        return sorted(Permission.objects.filter(is_active=True).values_list("code", flat=True))
    return []
