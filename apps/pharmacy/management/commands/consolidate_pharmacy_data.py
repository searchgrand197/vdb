from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.inventory.models import (
    Medicine,
    MedicineBatch,
    MedicineCategory,
    MedicineReorderRule,
    StockLedger,
    Unit,
)
from apps.pharmacy.models import (
    Pharmacy,
    PharmacyInvoice,
    PharmacyInvoiceItem,
    PharmacyOutletSettings,
    PharmacyPurchaseChallan,
    PharmacyPurchaseChallanLine,
    PharmacySupplier,
)


class Command(BaseCommand):
    help = "Move pharmacy data from other branches into one target branch (default: Saroj)."

    def add_arguments(self, parser):
        parser.add_argument("--target-slug", default="saroj")
        parser.add_argument("--target-name", default="Saroj")
        parser.add_argument(
            "--hospital-name",
            default="",
            help="Optional hospital filter when multiple hospitals exist.",
        )
        parser.add_argument(
            "--deactivate-sources",
            action="store_true",
            help="Deactivate source branches after consolidation.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        target_slug = (options.get("target_slug") or "saroj").strip().lower()
        target_name = (options.get("target_name") or "Saroj").strip()
        hospital_name = (options.get("hospital_name") or "").strip()
        deactivate_sources = bool(options.get("deactivate_sources"))

        base_qs = Pharmacy.objects.all()
        if hospital_name:
            base_qs = base_qs.filter(hospital__name__iexact=hospital_name)

        target = (
            base_qs.filter(slug__iexact=target_slug).first()
            or base_qs.filter(name__iexact=target_name).first()
            or base_qs.filter(display_name__iexact=target_name).first()
        )
        if target is None:
            raise CommandError(
                f"Target pharmacy not found (slug='{target_slug}', name='{target_name}')."
            )

        sources = Pharmacy.objects.filter(hospital=target.hospital).exclude(id=target.id)
        if not sources.exists():
            self.stdout.write(self.style.WARNING("No source branches found to consolidate."))
            return

        self.stdout.write(
            self.style.NOTICE(
                f"Consolidating data into target '{target.display_name or target.name}' ({target.id})"
            )
        )

        # 1) Move supplier-like entities first.
        moved_suppliers = PharmacySupplier.objects.filter(pharmacy__in=sources).update(pharmacy=target)
        moved_challans = PharmacyPurchaseChallan.objects.filter(pharmacy__in=sources).update(pharmacy=target)
        moved_invoices = PharmacyInvoice.objects.filter(pharmacy__in=sources).update(pharmacy=target)

        # 2) Merge outlet settings.
        target_settings, _ = PharmacyOutletSettings.objects.get_or_create(pharmacy=target, defaults={"business_name": target.name})
        for src in PharmacyOutletSettings.objects.select_for_update().filter(pharmacy__in=sources):
            changed = False
            for field in [
                "business_name",
                "address",
                "mobile",
                "gst_number",
                "dl_number",
                "email",
                "website",
                "invoice_prefix",
            ]:
                if not getattr(target_settings, field):
                    setattr(target_settings, field, getattr(src, field))
                    changed = True
            if target_settings.invoice_next_number < (src.invoice_next_number or 1):
                target_settings.invoice_next_number = src.invoice_next_number or 1
                changed = True
            if changed:
                target_settings.save()
            src.delete()

        # 3) Merge units by code.
        unit_map: dict[str, str] = {}
        for src_unit in Unit.objects.select_related("pharmacy").filter(pharmacy__in=sources):
            tgt_unit = Unit.objects.filter(pharmacy=target, code=src_unit.code).first()
            if tgt_unit is None:
                src_unit.pharmacy = target
                src_unit.save(update_fields=["pharmacy", "updated_at"])
                unit_map[str(src_unit.id)] = str(src_unit.id)
            else:
                unit_map[str(src_unit.id)] = str(tgt_unit.id)

        # 4) Merge categories by (parent,name) within target.
        category_map: dict[str, str] = {}
        src_categories = list(
            MedicineCategory.objects.select_related("parent").filter(pharmacy__in=sources).order_by("created_at")
        )
        for src_cat in src_categories:
            tgt_parent_id = None
            if src_cat.parent_id:
                tgt_parent_id = category_map.get(str(src_cat.parent_id), src_cat.parent_id)
            tgt_cat = MedicineCategory.objects.filter(
                pharmacy=target,
                parent_id=tgt_parent_id,
                name=src_cat.name,
            ).first()
            if tgt_cat is None:
                src_cat.pharmacy = target
                src_cat.parent_id = tgt_parent_id
                src_cat.save(update_fields=["pharmacy", "parent", "updated_at"])
                category_map[str(src_cat.id)] = str(src_cat.id)
            else:
                category_map[str(src_cat.id)] = str(tgt_cat.id)

        # 5) Merge medicines by SKU into target branch.
        medicine_map: dict[str, str] = {}
        for src_med in Medicine.objects.select_related("unit", "category").filter(pharmacy__in=sources):
            mapped_unit_id = unit_map.get(str(src_med.unit_id), str(src_med.unit_id))
            mapped_category_id = (
                category_map.get(str(src_med.category_id), str(src_med.category_id))
                if src_med.category_id
                else None
            )
            tgt_med = Medicine.objects.filter(pharmacy=target, sku=src_med.sku).first()
            if tgt_med is None:
                src_med.pharmacy = target
                src_med.unit_id = mapped_unit_id
                src_med.category_id = mapped_category_id
                src_med.save(update_fields=["pharmacy", "unit", "category", "updated_at"])
                medicine_map[str(src_med.id)] = str(src_med.id)
            else:
                medicine_map[str(src_med.id)] = str(tgt_med.id)
                PharmacyInvoiceItem.objects.filter(medicine_id=src_med.id).update(medicine_id=tgt_med.id)
                MedicineReorderRule.objects.filter(medicine_id=src_med.id).update(medicine_id=tgt_med.id)

        # 6) Merge batches by (medicine,batch_no) in target.
        batch_map: dict[str, str] = {}
        for src_batch in MedicineBatch.objects.select_related("medicine").filter(pharmacy__in=sources):
            mapped_med_id = medicine_map.get(str(src_batch.medicine_id), str(src_batch.medicine_id))
            tgt_batch = MedicineBatch.objects.filter(
                pharmacy=target,
                medicine_id=mapped_med_id,
                batch_no=src_batch.batch_no,
            ).first()
            if tgt_batch is None:
                src_batch.pharmacy = target
                src_batch.medicine_id = mapped_med_id
                src_batch.save(update_fields=["pharmacy", "medicine", "updated_at"])
                batch_map[str(src_batch.id)] = str(src_batch.id)
            else:
                batch_map[str(src_batch.id)] = str(tgt_batch.id)
                PharmacyInvoiceItem.objects.filter(batch_id=src_batch.id).update(batch_id=tgt_batch.id)
                PharmacyPurchaseChallanLine.objects.filter(batch_id=src_batch.id).update(batch_id=tgt_batch.id)

        # 7) Move stock ledger/reorder rules to target using mapped medicine/batch.
        for row in StockLedger.objects.filter(pharmacy__in=sources):
            row.pharmacy = target
            if row.medicine_id:
                row.medicine_id = medicine_map.get(str(row.medicine_id), str(row.medicine_id))
            if row.batch_id:
                row.batch_id = batch_map.get(str(row.batch_id), str(row.batch_id))
            row.save(update_fields=["pharmacy", "medicine", "batch", "updated_at"])

        for rule in MedicineReorderRule.objects.filter(pharmacy__in=sources):
            rule.pharmacy = target
            if rule.medicine_id:
                rule.medicine_id = medicine_map.get(str(rule.medicine_id), str(rule.medicine_id))
            existing = MedicineReorderRule.objects.filter(pharmacy=target, medicine_id=rule.medicine_id).exclude(id=rule.id).first()
            if existing:
                if existing.reorder_level < rule.reorder_level:
                    existing.reorder_level = rule.reorder_level
                    existing.save(update_fields=["reorder_level", "updated_at"])
                rule.delete()
            else:
                rule.save(update_fields=["pharmacy", "medicine", "updated_at"])

        # 8) Ensure any remaining invoice items/challan lines point to mapped objects.
        for old_med_id, new_med_id in medicine_map.items():
            if old_med_id != new_med_id:
                PharmacyPurchaseChallanLine.objects.filter(medicine_id=old_med_id).update(medicine_id=new_med_id)
        for old_batch_id, new_batch_id in batch_map.items():
            if old_batch_id != new_batch_id:
                PharmacyInvoiceItem.objects.filter(batch_id=old_batch_id).update(batch_id=new_batch_id)
                PharmacyPurchaseChallanLine.objects.filter(batch_id=old_batch_id).update(batch_id=new_batch_id)

        # 9) Optional: deactivate old branches after merge.
        if deactivate_sources:
            sources.update(is_active=False)

        self.stdout.write(
            self.style.SUCCESS(
                "Consolidation complete. "
                f"Moved suppliers={moved_suppliers}, challans={moved_challans}, invoices={moved_invoices}. "
                f"Target branch: {target.display_name or target.name}. "
                f"Sources deactivated={deactivate_sources}."
            )
        )
