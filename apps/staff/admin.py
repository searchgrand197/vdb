from django.contrib import admin

from .models import (
    Department,
    Designation,
    EmergencyContact,
    Shift,
    StaffAvailabilityOverride,
    StaffIDProof,
    StaffProfile,
    StaffShiftAssignment,
)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "code", "hospital", "is_active")
    search_fields = ("name", "code")


@admin.register(Designation)
class DesignationAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "code", "hospital", "is_active")
    search_fields = ("name", "code")


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "hospital", "start_time", "end_time", "is_active")


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "employee_code", "user", "hospital", "employment_status", "is_deleted")
    list_filter = ("hospital", "employment_status", "is_deleted")
    search_fields = ("employee_code", "user__email", "first_name", "last_name")


@admin.register(EmergencyContact)
class StaffEmergencyContactAdmin(admin.ModelAdmin):
    list_display = ("id", "staff", "name", "phone")


@admin.register(StaffIDProof)
class StaffIDProofAdmin(admin.ModelAdmin):
    list_display = ("id", "staff", "proof_type")


@admin.register(StaffShiftAssignment)
class StaffShiftAssignmentAdmin(admin.ModelAdmin):
    list_display = ("id", "staff", "shift", "status", "date", "hospital")


@admin.register(StaffAvailabilityOverride)
class StaffAvailabilityOverrideAdmin(admin.ModelAdmin):
    list_display = ("id", "staff", "date", "is_available", "hospital")
