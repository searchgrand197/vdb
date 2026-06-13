from django import forms
from django.contrib import admin

from apps.roles_permissions.portal_registry import ALL_PORTAL_CODES, PORTAL_LABELS

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


class DesignationAdminForm(forms.ModelForm):
    allowed_portals = forms.MultipleChoiceField(
        choices=[(code, PORTAL_LABELS.get(code, code)) for code in ALL_PORTAL_CODES],
        required=False,
        widget=forms.CheckboxSelectMultiple,
        help_text=(
            "Staff linked to this designation (with a user account) may sign in to the selected portals. "
            "Superusers always have access to all portals."
        ),
    )

    class Meta:
        model = Designation
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.initial["allowed_portals"] = list(self.instance.allowed_portals or [])


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "code", "hospital", "is_active")
    search_fields = ("name", "code")


@admin.register(Designation)
class DesignationAdmin(admin.ModelAdmin):
    form = DesignationAdminForm
    list_display = (
        "name",
        "code",
        "hospital",
        "is_active",
        "display_allowed_portals",
        "display_allowed_pharmacies",
        "is_deleted",
    )
    list_filter = ("hospital", "is_active", "is_deleted")
    search_fields = ("name", "code")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    filter_horizontal = ("allowed_pharmacies",)
    fieldsets = (
        (
            None,
            {
                "fields": ("hospital", "code", "name", "is_active", "is_deleted", "deleted_at"),
            },
        ),
        (
            "Portal access",
            {
                "fields": ("allowed_portals", "allowed_pharmacies"),
                "description": (
                    "Same setting as HMS Admin → Portal access. "
                    "Portal codes: staff, doctor, receptionist, lab, pharmacy, admin. "
                    "For pharmacy portal, leave allowed pharmacies empty for all branches."
                ),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("id", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    @admin.display(description="Portal access")
    def display_allowed_portals(self, obj):
        portals = obj.allowed_portals or []
        if not portals:
            return "—"
        return ", ".join(PORTAL_LABELS.get(code, code) for code in portals)

    @admin.display(description="Pharmacy branches")
    def display_allowed_pharmacies(self, obj):
        pharmacies = list(obj.allowed_pharmacies.all()[:5])
        if not pharmacies:
            return "All branches"
        labels = [p.branch_label for p in pharmacies]
        extra = obj.allowed_pharmacies.count() - len(labels)
        if extra > 0:
            labels.append(f"+{extra} more")
        return ", ".join(labels)


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "hospital", "start_time", "end_time", "is_active")


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "employee_code",
        "user",
        "designation",
        "hospital",
        "display_allowed_pharmacies",
        "employment_status",
        "is_deleted",
    )
    list_filter = ("hospital", "employment_status", "is_deleted", "designation")
    search_fields = ("employee_code", "user__email", "first_name", "last_name")
    autocomplete_fields = ("user", "department", "designation")
    filter_horizontal = ("allowed_pharmacies",)
    readonly_fields = ("deleted_at",)
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "hospital",
                    "user",
                    "employee_code",
                    "first_name",
                    "last_name",
                    "phone",
                    "address",
                    "department",
                    "designation",
                    "joining_date",
                    "employment_status",
                    "is_deleted",
                    "deleted_at",
                ),
            },
        ),
        (
            "Pharmacy access",
            {
                "fields": ("allowed_pharmacies",),
                "description": "Leave empty to allow all pharmacy branches. Select one or more to restrict.",
            },
        ),
    )

    @admin.display(description="Pharmacy access")
    def display_allowed_pharmacies(self, obj):
        pharmacies = list(obj.allowed_pharmacies.all()[:5])
        if not pharmacies:
            return "All branches"
        labels = [p.branch_label for p in pharmacies]
        extra = obj.allowed_pharmacies.count() - len(labels)
        if extra > 0:
            labels.append(f"+{extra} more")
        return ", ".join(labels)


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
