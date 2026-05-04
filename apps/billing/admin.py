from django.contrib import admin

from .models import BillingInvoice, DailyClosingSummary, InvoiceItem, InvoiceNumberSequence


@admin.register(InvoiceNumberSequence)
class InvoiceNumberSequenceAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "year", "last_seq", "created_at", "updated_at")


@admin.register(BillingInvoice)
class BillingInvoiceAdmin(admin.ModelAdmin):
    list_display = ("id", "invoice_no", "patient", "encounter_type", "status", "hospital", "invoice_date", "is_deleted")
    list_filter = ("hospital", "status", "encounter_type", "is_deleted")
    search_fields = ("invoice_no", "id")


@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = ("id", "invoice", "description", "line_total")


@admin.register(DailyClosingSummary)
class DailyClosingSummaryAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "closing_date", "total_collected", "total_outstanding")
