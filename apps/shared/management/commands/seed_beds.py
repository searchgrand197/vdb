"""
Seed realistic hospital floors, rooms, and beds.
Usage: python manage.py seed_beds
       python manage.py seed_beds --clear
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.beds.models import Bed, BedRoom, Floor
from apps.shared.models import Hospital


STRUCTURE = [
    {
        "floor_number": -1,
        "name": "Basement",
        "rooms": [
            {"name": "Emergency Ward", "room_number": "B-01", "type": "emergency", "is_ac": True, "charge": 800, "beds": 8},
            {"name": "Casualty Room", "room_number": "B-02", "type": "emergency", "is_ac": True, "charge": 600, "beds": 4},
        ],
    },
    {
        "floor_number": 0,
        "name": "Ground Floor",
        "rooms": [
            {"name": "General Ward A", "room_number": "G-01", "type": "ward", "is_ac": False, "charge": 500, "beds": 10},
            {"name": "General Ward B", "room_number": "G-02", "type": "ward", "is_ac": False, "charge": 500, "beds": 10},
            {"name": "Shared Room 1", "room_number": "G-03", "type": "shared", "is_ac": True, "charge": 1200, "beds": 2},
            {"name": "Shared Room 2", "room_number": "G-04", "type": "shared", "is_ac": True, "charge": 1200, "beds": 2},
            {"name": "Extension Ward", "room_number": "G-05", "type": "ward", "is_ac": False, "charge": 500, "beds": 5},
        ],
    },
    {
        "floor_number": 1,
        "name": "1st Floor – Surgical",
        "rooms": [
            {"name": "Surgical Ward", "room_number": "1-01", "type": "ward", "is_ac": True, "charge": 700, "beds": 12},
            {"name": "Post-Op Recovery", "room_number": "1-02", "type": "ward", "is_ac": True, "charge": 900, "beds": 6},
            {"name": "Shared Room A", "room_number": "1-03", "type": "shared", "is_ac": True, "charge": 1500, "beds": 3},
            {"name": "Personal Room 101", "room_number": "101", "type": "personal", "is_ac": True, "charge": 3000, "beds": 1},
            {"name": "Personal Room 102", "room_number": "102", "type": "personal", "is_ac": True, "charge": 3000, "beds": 1},
            {"name": "Personal Room 103", "room_number": "103", "type": "personal", "is_ac": False, "charge": 2000, "beds": 1},
        ],
    },
    {
        "floor_number": 2,
        "name": "2nd Floor – Medical",
        "rooms": [
            {"name": "Medical Ward", "room_number": "2-01", "type": "ward", "is_ac": True, "charge": 700, "beds": 10},
            {"name": "Cardiology Ward", "room_number": "2-02", "type": "ward", "is_ac": True, "charge": 900, "beds": 8},
            {"name": "Shared Room B", "room_number": "2-03", "type": "shared", "is_ac": True, "charge": 1800, "beds": 2},
            {"name": "Personal Room 201", "room_number": "201", "type": "personal", "is_ac": True, "charge": 3500, "beds": 1},
            {"name": "Personal Room 202", "room_number": "202", "type": "personal", "is_ac": True, "charge": 3500, "beds": 1},
            {"name": "Personal Room 203", "room_number": "203", "type": "personal", "is_ac": True, "charge": 4500, "beds": 1},
        ],
    },
    {
        "floor_number": 3,
        "name": "3rd Floor – ICU & VIP",
        "rooms": [
            {"name": "ICU", "room_number": "3-ICU", "type": "icu", "is_ac": True, "charge": 8000, "beds": 6},
            {"name": "NICU", "room_number": "3-NICU", "type": "icu", "is_ac": True, "charge": 10000, "beds": 4},
            {"name": "VIP Suite 301", "room_number": "301", "type": "personal", "is_ac": True, "charge": 8000, "beds": 1},
            {"name": "VIP Suite 302", "room_number": "302", "type": "personal", "is_ac": True, "charge": 8000, "beds": 1},
            {"name": "VIP Suite 303", "room_number": "303", "type": "personal", "is_ac": True, "charge": 10000, "beds": 1},
        ],
    },
]

ROOM_TYPE_MAP = {
    "ward": BedRoom.RoomType.WARD,
    "personal": BedRoom.RoomType.PERSONAL,
    "shared": BedRoom.RoomType.SHARED,
    "icu": BedRoom.RoomType.ICU,
    "emergency": BedRoom.RoomType.EMERGENCY,
}

ROOM_PREFIX_MAP = {
    "ward": "W",
    "personal": "P",
    "shared": "S",
    "icu": "I",
    "emergency": "E",
}


class Command(BaseCommand):
    help = "Seed hospital floors, rooms, and beds"

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Delete existing beds/rooms/floors first")

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write(self.style.ERROR("No hospital found."))
            return

        self.stdout.write(f"Hospital: {self.style.SUCCESS(hospital.name)}")

        if options["clear"]:
            Bed.objects.filter(hospital=hospital).delete()
            BedRoom.objects.filter(hospital=hospital).delete()
            Floor.objects.filter(hospital=hospital).delete()
            self.stdout.write(self.style.WARNING("Cleared existing data."))

        total_floors = total_rooms = total_beds = 0

        for fl_data in STRUCTURE:
            floor, created = Floor.objects.get_or_create(
                hospital=hospital,
                floor_number=fl_data["floor_number"],
                defaults={"name": fl_data["name"], "is_active": True},
            )
            if created:
                total_floors += 1
            self.stdout.write(f"  Floor: {floor.name}")

            for rm_data in fl_data["rooms"]:
                room, created = BedRoom.objects.get_or_create(
                    hospital=hospital,
                    floor=floor,
                    room_number=rm_data["room_number"],
                    defaults={
                        "name": rm_data["name"],
                        "room_type": ROOM_TYPE_MAP[rm_data["type"]],
                        "is_ac": rm_data["is_ac"],
                        "daily_charge": rm_data["charge"],
                        "max_beds": rm_data["beds"],
                        "is_active": True,
                    },
                )
                if created:
                    total_rooms += 1

                prefix = ROOM_PREFIX_MAP[rm_data["type"]]
                for b in range(1, rm_data["beds"] + 1):
                    bed_code = f"{rm_data['room_number']}-{b:02d}"
                    _, created = Bed.objects.get_or_create(
                        hospital=hospital,
                        bed_code=bed_code,
                        defaults={
                            "room": room,
                            "bed_number": str(b),
                            "status": Bed.Status.AVAILABLE,
                        },
                    )
                    if created:
                        total_beds += 1

                self.stdout.write(
                    f"    {self.style.SUCCESS(room.name)} [{rm_data['type'].upper()}] "
                    f"{'[AC]' if rm_data['is_ac'] else '[FAN]'} "
                    f"Rs.{rm_data['charge']}/day  {rm_data['beds']} beds"
                )

        self.stdout.write(self.style.SUCCESS(
            f"\nDone! {total_floors} floors, {total_rooms} rooms, {total_beds} beds created."
        ))
        self.stdout.write(f"Total beds in DB: {Bed.objects.filter(hospital=hospital).count()}")
