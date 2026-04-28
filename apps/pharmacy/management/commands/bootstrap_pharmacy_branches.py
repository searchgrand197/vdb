from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from apps.pharmacy.models import Pharmacy
from apps.shared.models import Hospital


class Command(BaseCommand):
    help = "Ensure default hospital has Saroj and Realizer pharmacy branches."

    def add_arguments(self, parser):
        parser.add_argument("--hospital-name", default="Default Hospital")
        parser.add_argument("--hospital-slug", default="default-hospital")

    @transaction.atomic
    def handle(self, *args, **options):
        hospital_name = (options.get("hospital_name") or "Default Hospital").strip()
        hospital_slug = (options.get("hospital_slug") or slugify(hospital_name)).strip() or "default-hospital"

        hospital, _ = Hospital.objects.get_or_create(
            name=hospital_name,
            defaults={"slug": hospital_slug, "timezone": "UTC", "is_active": True},
        )

        if not hospital.slug:
            hospital.slug = hospital_slug
            hospital.save(update_fields=["slug", "updated_at"])

        desired = (
            ("saroj", "Saroj"),
            ("realizer", "Realizer"),
        )

        created_count = 0
        updated_count = 0
        deactivated_count = 0
        keep_ids = set()
        for slug, display in desired:
            by_slug = Pharmacy.objects.filter(hospital=hospital, slug=slug).order_by("created_at")
            by_name = Pharmacy.objects.filter(hospital=hospital, name__iexact=display).order_by("created_at")
            pharmacy = by_slug.first() or by_name.first()
            if pharmacy is None:
                pharmacy = Pharmacy.objects.create(
                    hospital=hospital,
                    slug=slug,
                    name=display,
                    display_name=display,
                    is_active=True,
                )
                created_count += 1
                keep_ids.add(pharmacy.id)
                continue

            changed = False
            if pharmacy.slug != slug:
                pharmacy.slug = slug
                changed = True
            if pharmacy.name != display:
                pharmacy.name = display
                changed = True
            if pharmacy.display_name != display:
                pharmacy.display_name = display
                changed = True
            if not pharmacy.is_active:
                pharmacy.is_active = True
                changed = True
            if changed:
                pharmacy.save(update_fields=["slug", "name", "display_name", "is_active", "updated_at"])
                updated_count += 1
            keep_ids.add(pharmacy.id)

            dupes = Pharmacy.objects.filter(hospital=hospital, name__iexact=display).exclude(id=pharmacy.id)
            for dup in dupes:
                if dup.is_active:
                    dup.is_active = False
                    dup.save(update_fields=["is_active", "updated_at"])
                    deactivated_count += 1

        extras = Pharmacy.objects.filter(hospital=hospital, is_active=True).exclude(id__in=keep_ids)
        for extra in extras:
            extra.is_active = False
            extra.save(update_fields=["is_active", "updated_at"])
            deactivated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Bootstrap complete for '{hospital.name}': created={created_count}, "
                f"updated={updated_count}, deactivated={deactivated_count}."
            )
        )
