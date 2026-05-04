from django.contrib import admin

from .models import DailyTokenCounter, Token, TokenStatusHistory


@admin.register(DailyTokenCounter)
class DailyTokenCounterAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "doctor", "date", "current_number")


@admin.register(Token)
class TokenAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "doctor", "patient", "date", "token_number", "status", "is_deleted")
    list_filter = ("hospital", "status", "is_deleted")


@admin.register(TokenStatusHistory)
class TokenStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("id", "token", "from_status", "to_status", "created_at")
