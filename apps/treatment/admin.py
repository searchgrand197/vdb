from django.contrib import admin

from .models import (
    PatientTimeline,
    TreatmentPlan,
    TreatmentPlanItem,
    TreatmentPlanStaffAssignment,
    TreatmentTask,
    TreatmentTemplateCatalog,
)


@admin.register(TreatmentPlan)
class TreatmentPlanAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "ipd_admission", "name", "start_date", "status", "created_at")
    list_filter = ("hospital", "status")


@admin.register(TreatmentPlanItem)
class TreatmentPlanItemAdmin(admin.ModelAdmin):
    list_display = ("id", "plan", "title", "category", "day_offset", "sequence", "is_active")


@admin.register(TreatmentTask)
class TreatmentTaskAdmin(admin.ModelAdmin):
    list_display = ("id", "ipd_admission", "plan_item", "date", "status", "priority", "assigned_staff")
    list_filter = ("status", "priority", "date")


@admin.register(TreatmentPlanStaffAssignment)
class TreatmentPlanStaffAssignmentAdmin(admin.ModelAdmin):
    list_display = ("id", "plan", "staff", "role_label")


@admin.register(PatientTimeline)
class PatientTimelineAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "patient", "event_type", "title", "timestamp")
    list_filter = ("hospital", "event_type")


@admin.register(TreatmentTemplateCatalog)
class TreatmentTemplateCatalogAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "updated_by", "updated_at")
