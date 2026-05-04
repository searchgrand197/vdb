from django.contrib import admin

from .models import OPDTemplate


@admin.register(OPDTemplate)
class OPDTemplateAdmin(admin.ModelAdmin):
    list_display = ("id", "key", "name", "updated_at")
    search_fields = ("key", "name")
