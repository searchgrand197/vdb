from django.contrib import admin

from .models import CashHandover, PaymentQuickService, PaymentSlipSequence, PaymentTransaction, RefundLog


@admin.register(PaymentSlipSequence)
class PaymentSlipSequenceAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "year", "last_seq", "created_at", "updated_at")


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "slip_number", "invoice", "amount", "payment_mode", "status", "hospital", "paid_at", "is_deleted")
    list_filter = ("hospital", "status", "payment_mode", "is_deleted")
    search_fields = ("slip_number", "receipt_no", "transaction_reference", "id")


@admin.register(RefundLog)
class RefundLogAdmin(admin.ModelAdmin):
    list_display = ("id", "invoice", "amount", "hospital", "refunded_at")


@admin.register(CashHandover)
class CashHandoverAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "from_user", "to_user", "status", "created_at")
    list_filter = ("hospital", "status")


@admin.register(PaymentQuickService)
class PaymentQuickServiceAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "label", "price", "is_active", "sort_order")
