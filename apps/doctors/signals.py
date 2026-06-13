"""
Ensure every DoctorProfile has a linked User so OPD and other flows that key on
doctor_user (User id) stay consistent. Admin/API often create profiles before a
portal account exists; we attach a placeholder login the hospital can replace later.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.doctors.models import DoctorProfile

User = get_user_model()


def attach_placeholder_user_if_missing(profile: DoctorProfile) -> bool:
    """
    Create a hospital-scoped User with unusable password and link it to the profile.

    Uses QuerySet.update for the FK so post_save is not re-fired for DoctorProfile.

    Returns True if a new user was linked.
    """
    if profile.user_id or profile.is_deleted or not profile.hospital_id:
        return False

    name = (profile.name or "").strip() or "Doctor"
    parts = name.split(maxsplit=1)
    first = (parts[0] or "Doctor")[:100]
    last = (parts[1][:100] if len(parts) > 1 else "")[:100]

    with transaction.atomic():
        base_email = f"doctor.{profile.pk.hex}@profile.local"
        email = base_email
        suffix = 0
        while User.objects.filter(email__iexact=email).exists():
            suffix += 1
            email = f"doctor.{profile.pk.hex}.{suffix}@profile.local"

        user = User(
            email=email,
            hospital_id=profile.hospital_id,
            first_name=first,
            last_name=last,
            is_active=True,
        )
        user.set_unusable_password()
        user.save()

        updated = DoctorProfile.objects.filter(pk=profile.pk, user__isnull=True).update(user_id=user.pk)
    return updated > 0


@receiver(post_save, sender=DoctorProfile)
def doctor_profile_ensure_user_link(sender, instance: DoctorProfile, **kwargs):
    if kwargs.get("raw"):
        return
    if instance.user_id or instance.is_deleted:
        return
    attach_placeholder_user_if_missing(instance)
