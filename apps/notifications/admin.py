from django.contrib import admin

from .models import Notification, WebPushSubscription


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "recipient", "notification_type", "title", "is_read", "created_at")
    list_filter = ("hospital", "notification_type", "is_read")
    search_fields = ("title", "reference_id")


@admin.register(WebPushSubscription)
class WebPushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "user", "is_active", "last_seen_at", "updated_at")
    list_filter = ("hospital", "is_active")
