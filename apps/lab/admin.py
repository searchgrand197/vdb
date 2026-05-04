from django.contrib import admin

from .models import LabReport, LabTest, LabTestCategory, LabTestResult


@admin.register(LabTestCategory)
class LabTestCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "hospital")
    search_fields = ("name",)


@admin.register(LabTest)
class LabTestAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "code", "hospital", "category", "is_active")
    search_fields = ("name", "code")


@admin.register(LabReport)
class LabReportAdmin(admin.ModelAdmin):
    list_display = ("id", "lab_no", "patient", "hospital", "status", "created_at")
    list_filter = ("hospital", "status")
    search_fields = ("lab_no", "id")


@admin.register(LabTestResult)
class LabTestResultAdmin(admin.ModelAdmin):
    list_display = ("id", "report", "test", "created_at")
