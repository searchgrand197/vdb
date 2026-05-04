from django.contrib import admin

from .models import FollowUp, FollowUpStatusHistory


@admin.register(FollowUp)
class FollowUpAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "doctor", "next_visit_date", "followup_status", "hospital", "is_deleted")
    list_filter = ("hospital", "followup_status", "reminder_status", "is_deleted")


@admin.register(FollowUpStatusHistory)
class FollowUpStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("id", "followup", "from_status", "to_status", "created_at")
