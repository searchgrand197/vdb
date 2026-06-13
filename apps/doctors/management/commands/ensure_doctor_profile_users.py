from django.core.management.base import BaseCommand

from apps.doctors.models import DoctorProfile
from apps.doctors.signals import attach_placeholder_user_if_missing


class Command(BaseCommand):
    help = "Link placeholder User accounts to DoctorProfile rows that have no user (e.g. legacy admin data)."

    def handle(self, *args, **options):
        qs = DoctorProfile.objects.filter(user__isnull=True, is_deleted=False).select_related("hospital")
        total = 0
        for profile in qs.iterator():
            if attach_placeholder_user_if_missing(profile):
                total += 1
                self.stdout.write(self.style.SUCCESS(f"Linked user for doctor profile {profile.pk} ({profile.name})"))
        if total == 0:
            self.stdout.write("No doctor profiles needed a user link.")
        else:
            self.stdout.write(self.style.SUCCESS(f"Done. Linked {total} profile(s)."))
