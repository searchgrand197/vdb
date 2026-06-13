from django.contrib import admin

from .models import (
    DischargeInvestigation,
    DischargeMedication,
    DischargeSummary,
    DischargeSummaryTemplate,
    DischargeSurgery,
)


@admin.register(DischargeSummary)
class DischargeSummaryAdmin(admin.ModelAdmin):
    list_display = ("id", "admission", "hospital", "discharge_date", "discharge_type", "is_deleted")
    list_filter = ("hospital", "discharge_type", "is_deleted")


@admin.register(DischargeSurgery)
class DischargeSurgeryAdmin(admin.ModelAdmin):
    list_display = ("id", "summary", "procedure_name", "surgery_date", "sort_order")


@admin.register(DischargeMedication)
class DischargeMedicationAdmin(admin.ModelAdmin):
    list_display = ("id", "summary", "drug_name", "dose", "frequency", "sort_order")


@admin.register(DischargeInvestigation)
class DischargeInvestigationAdmin(admin.ModelAdmin):
    list_display = ("id", "summary", "category", "test_name", "value", "sort_order")


@admin.register(DischargeSummaryTemplate)
class DischargeSummaryTemplateAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "hospital", "is_active", "updated_at")
    list_filter = ("hospital", "is_active")
