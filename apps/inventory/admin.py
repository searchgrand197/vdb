from django.contrib import admin

from .models import Medicine, MedicineBatch, MedicineCategory, MedicineReorderRule, StockLedger, Unit


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ("id", "pharmacy", "code", "name", "is_active")


@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
    list_display = ("id", "pharmacy", "sku", "name", "form", "is_active")
    search_fields = ("sku", "name", "composition")


@admin.register(MedicineCategory)
class MedicineCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "pharmacy", "name", "rule_type", "is_active")


@admin.register(MedicineReorderRule)
class MedicineReorderRuleAdmin(admin.ModelAdmin):
    list_display = ("id", "pharmacy", "medicine", "reorder_level", "is_active")


@admin.register(MedicineBatch)
class MedicineBatchAdmin(admin.ModelAdmin):
    list_display = ("id", "pharmacy", "medicine", "batch_no", "expiry_date", "mrp")


@admin.register(StockLedger)
class StockLedgerAdmin(admin.ModelAdmin):
    list_display = ("id", "pharmacy", "medicine", "batch", "reason", "qty_change", "created_at")
    list_filter = ("pharmacy", "reason")
