from django.contrib import admin

from apps.payments.models import PaymentTransaction, RefundLog


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ("slip_number", "invoice", "amount", "payment_mode", "status", "paid_at", "hospital")
    list_filter = ("payment_mode", "status", "hospital")
    search_fields = ("slip_number", "invoice__invoice_no", "transaction_reference", "receipt_no")
    date_hierarchy = "paid_at"


@admin.register(RefundLog)
class RefundLogAdmin(admin.ModelAdmin):
    list_display = ("invoice", "amount", "refunded_at", "hospital")
