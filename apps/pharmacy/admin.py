from django.contrib import admin

from apps.pharmacy.models import (
    PharmacyInvoice,
    PharmacyInvoiceItem,
    PharmacyOutletSettings,
    PharmacyPurchaseChallan,
    PharmacyPurchaseChallanLine,
    PharmacySupplier,
)


@admin.register(PharmacySupplier)
class PharmacySupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "pharmacy", "phone", "gst_number", "is_active", "updated_at")
    list_filter = ("is_active", "pharmacy")
    search_fields = ("name", "phone", "gst_number", "address")
    raw_id_fields = ("pharmacy",)


class PharmacyPurchaseChallanLineInline(admin.TabularInline):
    model = PharmacyPurchaseChallanLine
    extra = 0
    show_change_link = True
    raw_id_fields = ("medicine", "batch")
    readonly_fields = ("created_at", "updated_at")


@admin.register(PharmacyPurchaseChallan)
class PharmacyPurchaseChallanAdmin(admin.ModelAdmin):
    list_display = (
        "challan_no",
        "purchase_date",
        "pharmacy",
        "supplier",
        "supplier_name_snapshot",
        "total_items",
        "total_amount",
        "gst_enabled",
        "payment_type",
        "created_at",
    )
    list_filter = ("pharmacy", "gst_enabled", "payment_type", "purchase_date")
    search_fields = ("challan_no", "supplier_name_snapshot", "id")
    date_hierarchy = "purchase_date"
    raw_id_fields = ("pharmacy", "supplier", "created_by")
    readonly_fields = ("created_at", "updated_at")
    inlines = (PharmacyPurchaseChallanLineInline,)


@admin.register(PharmacyPurchaseChallanLine)
class PharmacyPurchaseChallanLineAdmin(admin.ModelAdmin):
    list_display = (
        "challan",
        "medicine",
        "batch",
        "pack_quantity",
        "base_qty",
        "purchase_rate",
        "final_amount",
        "created_at",
    )
    list_filter = ("quantity_basis", "rate_type", "challan__pharmacy")
    search_fields = ("challan__challan_no", "medicine__name", "batch__batch_no")
    raw_id_fields = ("challan", "medicine", "batch")
    readonly_fields = ("created_at", "updated_at")


@admin.register(PharmacyOutletSettings)
class PharmacyOutletSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "pharmacy",
        "business_name",
        "gst_number",
        "dl_number",
        "mobile",
        "default_gst_percent",
        "updated_at",
    )
    search_fields = ("business_name", "gst_number", "dl_number", "pharmacy__name", "email")
    raw_id_fields = ("pharmacy",)


class PharmacyInvoiceItemInline(admin.TabularInline):
    model = PharmacyInvoiceItem
    extra = 0
    show_change_link = True
    raw_id_fields = ("medicine", "batch")
    readonly_fields = ("created_at", "updated_at")


@admin.register(PharmacyInvoice)
class PharmacyInvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "invoice_no",
        "date",
        "pharmacy",
        "patient",
        "status",
        "gst_enabled",
        "grand_total",
        "payment_method",
        "paid_amount",
        "created_at",
    )
    list_filter = ("status", "gst_enabled", "payment_method", "pharmacy", "date")
    search_fields = (
        "invoice_no",
        "patient__uhid",
        "patient__first_name",
        "patient__last_name",
        "remarks",
    )
    date_hierarchy = "date"
    raw_id_fields = ("pharmacy", "patient", "ipd_admission", "referred_by", "created_by")
    readonly_fields = ("created_at", "updated_at")
    inlines = (PharmacyInvoiceItemInline,)


@admin.register(PharmacyInvoiceItem)
class PharmacyInvoiceItemAdmin(admin.ModelAdmin):
    list_display = (
        "invoice",
        "medicine",
        "batch",
        "qty",
        "rate",
        "amount",
        "cgst_rate",
        "sgst_rate",
        "created_at",
    )
    list_filter = ("invoice__pharmacy", "invoice__status")
    search_fields = ("invoice__invoice_no", "medicine__name", "batch__batch_no")
    raw_id_fields = ("invoice", "medicine", "batch")
    readonly_fields = ("created_at", "updated_at")
