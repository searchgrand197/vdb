from django.contrib import admin

from .models import LeaveApprover, ReceptionPortalSettings


@admin.register(LeaveApprover)
class LeaveApproverAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "user", "is_active")
    list_filter = ("hospital", "is_active")


@admin.register(ReceptionPortalSettings)
class ReceptionPortalSettingsAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "default_city", "default_state", "default_doctor_user")
