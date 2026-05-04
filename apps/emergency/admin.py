from django.contrib import admin

from .models import EmergencyCase


@admin.register(EmergencyCase)
class EmergencyCaseAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "patient_name", "status", "triage", "arrived_at")
    list_filter = ("hospital", "status", "triage")
    search_fields = ("patient_name", "contact")
