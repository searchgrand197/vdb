"""
Management command to seed 10 realistic doctor profiles.
Creates: User accounts, Specialties, DoctorProfiles.

Usage:
    python manage.py seed_doctors
    python manage.py seed_doctors --clear   (wipe existing doctor profiles first)
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.doctors.models import DoctorProfile, Specialty
from apps.shared.models import Hospital
from apps.staff.models import Department

User = get_user_model()

DOCTORS = [
    {
        "name": "Dr. Anil Sharma",
        "email": "dr.anil.sharma@hms.local",
        "specialty_code": "GENERAL_MED",
        "specialty_name": "General Medicine",
        "dept_code": "OPD",
        "doctor_type": "consultant",
        "fee": "500.00",
        "mobile": "9800000001",
    },
    {
        "name": "Dr. Priya Mehta",
        "email": "dr.priya.mehta@hms.local",
        "specialty_code": "CARDIOLOGY",
        "specialty_name": "Cardiology",
        "dept_code": "CARDIOLOGY",
        "doctor_type": "consultant",
        "fee": "1200.00",
        "mobile": "9800000002",
    },
    {
        "name": "Dr. Rakesh Gupta",
        "email": "dr.rakesh.gupta@hms.local",
        "specialty_code": "NEUROLOGY",
        "specialty_name": "Neurology",
        "dept_code": "NEUROLOGY",
        "doctor_type": "consultant",
        "fee": "1500.00",
        "mobile": "9800000003",
    },
    {
        "name": "Dr. Sana Verma",
        "email": "dr.sana.verma@hms.local",
        "specialty_code": "PEDIATRICS",
        "specialty_name": "Pediatrics",
        "dept_code": "PEDIATRICS",
        "doctor_type": "consultant",
        "fee": "800.00",
        "mobile": "9800000004",
    },
    {
        "name": "Dr. Mohit Joshi",
        "email": "dr.mohit.joshi@hms.local",
        "specialty_code": "ORTHOPEDICS",
        "specialty_name": "Orthopedics",
        "dept_code": "ORTHOPEDICS",
        "doctor_type": "consultant",
        "fee": "1000.00",
        "mobile": "9800000005",
    },
    {
        "name": "Dr. Kavita Rao",
        "email": "dr.kavita.rao@hms.local",
        "specialty_code": "GYNE_OBS",
        "specialty_name": "Gynecology & Obstetrics",
        "dept_code": "GYNE_OBS",
        "doctor_type": "consultant",
        "fee": "1100.00",
        "mobile": "9800000006",
    },
    {
        "name": "Dr. Deepak Patel",
        "email": "dr.deepak.patel@hms.local",
        "specialty_code": "DERMATOLOGY",
        "specialty_name": "Dermatology",
        "dept_code": "DERMATOLOGY",
        "doctor_type": "visiting",
        "fee": "700.00",
        "mobile": "9800000007",
    },
    {
        "name": "Dr. Nisha Singh",
        "email": "dr.nisha.singh@hms.local",
        "specialty_code": "ENT",
        "specialty_name": "ENT (Ear, Nose, Throat)",
        "dept_code": "ENT",
        "doctor_type": "consultant",
        "fee": "800.00",
        "mobile": "9800000008",
    },
    {
        "name": "Dr. Ramesh Tiwari",
        "email": "dr.ramesh.tiwari@hms.local",
        "specialty_code": "RADIOLOGY",
        "specialty_name": "Radiology",
        "dept_code": "RADIOLOGY",
        "doctor_type": "resident",
        "fee": "600.00",
        "mobile": "9800000009",
    },
    {
        "name": "Dr. Pooja Desai",
        "email": "dr.pooja.desai@hms.local",
        "specialty_code": "OPHTHALMOLOGY",
        "specialty_name": "Ophthalmology",
        "dept_code": "OPHTHALMOLOGY",
        "doctor_type": "consultant",
        "fee": "900.00",
        "mobile": "9800000010",
    },
]

DEFAULT_PASSWORD = "Doctor@1234"


class Command(BaseCommand):
    help = "Seed 10 realistic doctor profiles with user accounts"

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Delete existing doctor profiles before seeding")
        parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Password for all doctor accounts")

    @transaction.atomic
    def handle(self, *args, **options):
        password = options["password"]

        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write(self.style.ERROR("No hospital found. Run seed_initial first."))
            return

        self.stdout.write(f"Hospital: {self.style.SUCCESS(hospital.name)}")

        if options["clear"]:
            deleted, _ = DoctorProfile.objects.filter(hospital=hospital).delete()
            self.stdout.write(self.style.WARNING(f"Cleared {deleted} existing doctor profiles."))

        created_count = 0
        skipped_count = 0

        for doc in DOCTORS:
            # Get or create Department
            dept = Department.objects.filter(hospital=hospital, code=doc["dept_code"]).first()
            if not dept:
                dept, _ = Department.objects.get_or_create(
                    hospital=hospital,
                    code=doc["dept_code"],
                    defaults={"name": doc["dept_code"].replace("_", " ").title(), "is_active": True},
                )

            # Get or create Specialty
            specialty, _ = Specialty.objects.get_or_create(
                hospital=hospital,
                code=doc["specialty_code"],
                defaults={
                    "name": doc["specialty_name"],
                    "department": dept,
                    "is_active": True,
                },
            )

            # Get or create User account for the doctor
            user, user_created = User.objects.get_or_create(
                email=doc["email"],
                defaults={
                    "first_name": doc["name"].split()[1] if len(doc["name"].split()) > 1 else doc["name"],
                    "last_name": " ".join(doc["name"].split()[2:]) if len(doc["name"].split()) > 2 else "",
                    "hospital": hospital,
                    "is_active": True,
                    "is_staff": False,
                    "is_superuser": False,
                },
            )
            if user_created:
                user.set_password(password)
                user.save(update_fields=["password"])

            # Get or create DoctorProfile
            profile, created = DoctorProfile.objects.get_or_create(
                hospital=hospital,
                user=user,
                defaults={
                    "name": doc["name"],
                    "specialty": specialty,
                    "doctor_type": doc["doctor_type"],
                    "consultation_fee": doc["fee"],
                    "mobile_number": doc["mobile"],
                    "is_active": True,
                    "is_deleted": False,
                },
            )

            if created:
                profile.departments.add(dept)
                created_count += 1
                self.stdout.write(
                    f"  Created: {self.style.SUCCESS(doc['name'])} "
                    f"| {doc['specialty_name']} | {doc['email']}"
                )
            else:
                skipped_count += 1
                self.stdout.write(f"  Exists:  {doc['name']}")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done! {created_count} doctors created, {skipped_count} already existed."
        ))
        self.stdout.write(f"Login password for all doctors: {self.style.WARNING(password)}")
