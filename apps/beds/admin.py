from django.contrib import admin

from .models import Bed, BedCleaningTask, BedRoom, Floor


@admin.register(Floor)
class FloorAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "floor_number", "name", "is_active")


@admin.register(BedRoom)
class BedRoomAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "room_number", "floor", "room_type", "hospital", "is_active")


@admin.register(Bed)
class BedAdmin(admin.ModelAdmin):
    list_display = ("id", "bed_code", "bed_number", "room", "status", "hospital")
    list_filter = ("hospital", "status")


@admin.register(BedCleaningTask)
class BedCleaningTaskAdmin(admin.ModelAdmin):
    list_display = ("id", "bed", "status", "hospital", "created_at")
    list_filter = ("hospital", "status")
