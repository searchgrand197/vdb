from django.contrib import admin

from .models import (
    Pharmacy,
    PharmacyInvoice,
    PharmacyInvoiceItem,
    PharmacyOutletSettings,
    PharmacyPurchaseChallan,
    PharmacyPurchaseChallanLine,
    PharmacySupplier,
)


@admin.register(Pharmacy)
class PharmacyAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "hospital", "slug", "is_active")
    list_filter = ("hospital", "is_active")
    search_fields = ("name", "slug")


@admin.register(PharmacySupplier)
class PharmacySupplierAdmin(admin.ModelAdmin):
    list_display = ("id", "pharmacy", "name", "phone", "is_active")
    search_fields = ("name", "gst_number")


@admin.register(PharmacyPurchaseChallan)
class PharmacyPurchaseChallanAdmin(admin.ModelAdmin):
    list_display = ("id", "pharmacy", "challan_no", "purchase_date", "supplier", "total_amount", "created_at")
    list_filter = ("pharmacy", "purchase_date")


@admin.register(PharmacyPurchaseChallanLine)
class PharmacyPurchaseChallanLineAdmin(admin.ModelAdmin):
    list_display = ("id", "challan", "medicine", "base_qty", "final_amount")


@admin.register(PharmacyOutletSettings)
class PharmacyOutletSettingsAdmin(admin.ModelAdmin):
    list_display = ("id", "pharmacy", "business_name", "gst_number")


@admin.register(PharmacyInvoice)
class PharmacyInvoiceAdmin(admin.ModelAdmin):
    list_display = ("id", "invoice_no", "pharmacy", "patient", "date", "status", "grand_total")
    list_filter = ("pharmacy", "status", "date")
    search_fields = ("invoice_no", "id")


@admin.register(PharmacyInvoiceItem)
class PharmacyInvoiceItemAdmin(admin.ModelAdmin):
    list_display = ("id", "invoice", "medicine", "qty", "rate")
