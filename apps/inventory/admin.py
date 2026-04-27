from django.contrib import admin

from apps.inventory.models import Medicine, MedicineBatch, MedicineCategory, MedicineReorderRule, StockLedger, Unit


@admin.register(MedicineCategory)
class MedicineCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "pharmacy", "rule_type", "allow_loose_sale", "is_active")
    search_fields = ("name",)
    list_filter = ("rule_type", "allow_loose_sale", "is_active", "pharmacy")


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "pharmacy", "is_active")
    search_fields = ("code", "name")


@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "unit", "pharmacy", "is_active")
    search_fields = ("sku", "name")


@admin.register(MedicineBatch)
class MedicineBatchAdmin(admin.ModelAdmin):
    list_display = ("medicine", "batch_no", "expiry_date", "pharmacy")
    search_fields = ("batch_no", "medicine__name")


@admin.register(MedicineReorderRule)
class MedicineReorderRuleAdmin(admin.ModelAdmin):
    list_display = ("medicine", "reorder_level", "pharmacy", "is_active")


@admin.register(StockLedger)
class StockLedgerAdmin(admin.ModelAdmin):
    list_display = ("medicine", "batch", "qty_change", "reason", "created_at", "pharmacy")
    list_filter = ("reason", "pharmacy")
    date_hierarchy = "created_at"
