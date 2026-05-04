from django.contrib import admin

from .models import Appointment, AppointmentStatusHistory


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "doctor", "appointment_datetime", "status", "hospital", "is_deleted")
    list_filter = ("hospital", "status", "consultation_type", "is_deleted")
    search_fields = ("id",)


@admin.register(AppointmentStatusHistory)
class AppointmentStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("id", "appointment", "from_status", "to_status", "created_at")
