from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "module", "action", "object_type", "object_id", "actor", "created_at")
    list_filter = ("hospital", "module", "action")
    search_fields = ("object_id", "request_id", "module")
    date_hierarchy = "created_at"
