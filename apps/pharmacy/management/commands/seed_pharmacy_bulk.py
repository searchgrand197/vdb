import random
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.inventory.models import Medicine, MedicineBatch, MedicineCategory, StockLedger, Unit
from apps.patients.models import Patient
from apps.pharmacy.models import (
    Pharmacy,
    PharmacyInvoice,
    PharmacyInvoiceItem,
    PharmacyOutletSettings,
    PharmacyPurchaseChallan,
    PharmacyPurchaseChallanLine,
    PharmacySupplier,
)
from apps.shared.models import Hospital

User = get_user_model()

BRANCH_LABELS = (
    ("MAIN", "Main"),
    ("SAR", "Saroj"),
    ("REA", "Realizer"),
)


def _allocate(total, weight):
    return int(total * weight)


class Command(BaseCommand):
    help = "Seed 3 pharmacy branches with isolated, different demo data."

    def add_arguments(self, parser):
        parser.add_argument("--total", type=int, default=500, help="Total records budget across all 3 branches.")
        parser.add_argument("--hospital-name", type=str, default="Default Hospital")
        parser.add_argument("--reset", action="store_true", help="Delete only existing seeded rows before re-seeding.")

    @transaction.atomic
    def handle(self, *args, **options):
        total = max(120, int(options["total"]))
        hospital_name = (options.get("hospital_name") or "Default Hospital").strip()
        hospital = Hospital.objects.filter(name__iexact=hospital_name).first()
        if not hospital:
            raise CommandError(f"Hospital not found: {hospital_name}")

        pharmacies = list(Pharmacy.objects.filter(hospital=hospital, is_active=True).order_by("name")[:3])
        if len(pharmacies) < 3:
            raise CommandError("Need at least 3 active pharmacy branches under Default Hospital.")

        # Stable branch->seed mapping for deterministic output.
        branch_seed = {}
        for idx, pharmacy in enumerate(pharmacies):
            label = BRANCH_LABELS[idx][0]
            branch_seed[pharmacy.id] = (label, 111 + (idx * 101))

        user = (
            User.objects.filter(hospital=hospital, is_active=True).first()
            or User.objects.filter(is_superuser=True, is_active=True).first()
            or User.objects.filter(is_active=True).first()
        )
        if not user:
            raise CommandError("No active user found. Create at least one active user.")

        if options["reset"]:
            for pharmacy in pharmacies:
                PharmacyInvoiceItem.objects.filter(invoice__pharmacy=pharmacy, invoice__invoice_no__startswith="SEED-").delete()
                PharmacyInvoice.objects.filter(pharmacy=pharmacy, invoice_no__startswith="SEED-").delete()
                PharmacyPurchaseChallanLine.objects.filter(challan__pharmacy=pharmacy, challan__challan_no__startswith="SEED-").delete()
                PharmacyPurchaseChallan.objects.filter(pharmacy=pharmacy, challan_no__startswith="SEED-").delete()
                StockLedger.objects.filter(pharmacy=pharmacy, reference_type="seed").delete()
                MedicineBatch.objects.filter(pharmacy=pharmacy, batch_no__startswith="SEED-").delete()
                Medicine.objects.filter(pharmacy=pharmacy, sku__startswith="SEED-").delete()
                MedicineCategory.objects.filter(pharmacy=pharmacy, name__startswith="SEED ").delete()
                PharmacySupplier.objects.filter(pharmacy=pharmacy, name__startswith="SEED ").delete()
                Patient.objects.filter(hospital=hospital, uhid__startswith=f"SEED-{pharmacy.id.hex[:6].upper()}-").delete()

        # Budget split across section entities (per all branches total).
        budgets = {
            "categories": _allocate(total, 0.08),
            "medicines": _allocate(total, 0.17),
            "batches": _allocate(total, 0.17),
            "ledger": _allocate(total, 0.12),
            "suppliers": _allocate(total, 0.08),
            "challans": _allocate(total, 0.08),
            "invoices": _allocate(total, 0.15),
            "invoice_items": _allocate(total, 0.15),
        }
        used = sum(budgets.values())
        if used < total:
            budgets["invoice_items"] += total - used

        summary = {k: 0 for k in budgets}
        summary["patients"] = 0
        summary["settings"] = 0
        today = timezone.localdate()

        for idx, pharmacy in enumerate(pharmacies):
            tag, seed_val = branch_seed[pharmacy.id]
            rng = random.Random(seed_val)
            share = 1 / len(pharmacies)

            cat_n = max(4, _allocate(budgets["categories"], share))
            med_n = max(10, _allocate(budgets["medicines"], share))
            batch_n = max(10, _allocate(budgets["batches"], share))
            ledger_n = max(8, _allocate(budgets["ledger"], share))
            sup_n = max(3, _allocate(budgets["suppliers"], share))
            challan_n = max(3, _allocate(budgets["challans"], share))
            inv_n = max(6, _allocate(budgets["invoices"], share))
            inv_item_n = max(8, _allocate(budgets["invoice_items"], share))
            patient_n = max(12, _allocate(total, 0.08 * share))

            settings, created = PharmacyOutletSettings.objects.get_or_create(
                pharmacy=pharmacy,
                defaults={
                    "business_name": f"{BRANCH_LABELS[idx][1]} Pharmacy",
                    "address": f"{BRANCH_LABELS[idx][1]} Market, Default City",
                    "mobile": f"98{idx + 11}0000{idx + 3}{idx + 7}",
                    "gst_number": f"27{(idx+1)}ABCDE{(idx+2)}F{idx+1}Z{idx+1}",
                    "dl_number": f"DL-{tag}-{1000 + idx}",
                    "email": f"{tag.lower()}@pharmacy.demo",
                    "website": f"https://{tag.lower()}.demo.local",
                },
            )
            if created:
                summary["settings"] += 1

            unit, _ = Unit.objects.get_or_create(
                pharmacy=pharmacy,
                code="TAB",
                defaults={"name": "Tablet", "is_active": True},
            )

            categories = []
            for i in range(cat_n):
                obj, created = MedicineCategory.objects.get_or_create(
                    pharmacy=pharmacy,
                    name=f"SEED {tag} CATEGORY {i+1:03d}",
                    defaults={"is_active": True},
                )
                categories.append(obj)
                if created:
                    summary["categories"] += 1

            medicines = []
            for i in range(med_n):
                pack = rng.choice([5, 10, 15, 20, 30])
                default_mrp = Decimal(str(rng.randint(35, 420)))
                med, created = Medicine.objects.get_or_create(
                    pharmacy=pharmacy,
                    sku=f"SEED-{tag}-MED-{i+1:04d}",
                    defaults={
                        "name": f"{BRANCH_LABELS[idx][1]} Seed Medicine {i+1:03d}",
                        "company_name": f"{BRANCH_LABELS[idx][1]} Labs {((i % 12) + 1):02d}",
                        "form": categories[i % len(categories)].name,
                        "composition": f"Comp-{tag}-{(i % 19) + 1}",
                        "strength": f"{((i % 7) + 1) * 50}mg",
                        "unit": unit,
                        "hsn_code": "3004",
                        "pack_info": f"1x{pack}",
                        "default_mrp": default_mrp,
                        "unit_conversions": {"strip": pack},
                        "gst_percent": Decimal(str(rng.choice([5, 12]))),
                        "is_active": True,
                    },
                )
                medicines.append(med)
                if created:
                    summary["medicines"] += 1

            batches = []
            for i in range(batch_n):
                med = medicines[i % len(medicines)]
                batch, created = MedicineBatch.objects.get_or_create(
                    pharmacy=pharmacy,
                    medicine=med,
                    batch_no=f"SEED-{tag}-BATCH-{i+1:04d}",
                    defaults={
                        "expiry_date": today + timedelta(days=120 + rng.randint(0, 420)),
                        "mfg_date": today - timedelta(days=30 + rng.randint(0, 210)),
                        "unit_cost": Decimal(str(rng.randint(18, 220))),
                        "mrp": med.default_mrp,
                        "sale_rate": (med.default_mrp * Decimal("0.92")).quantize(Decimal("0.01")),
                    },
                )
                batches.append(batch)
                if created:
                    summary["batches"] += 1

            for i in range(ledger_n):
                b = batches[i % len(batches)]
                entry = StockLedger.objects.filter(
                    pharmacy=pharmacy,
                    batch=b,
                    reference_type="seed",
                    reference_id=f"{tag}-ledger-{i+1:04d}",
                ).exists()
                if not entry:
                    StockLedger.objects.create(
                        pharmacy=pharmacy,
                        medicine=b.medicine,
                        batch=b,
                        qty_change=Decimal(str(rng.randint(10, 180))),
                        reason=StockLedger.Reason.STOCK_IN,
                        reference_type="seed",
                        reference_id=f"{tag}-ledger-{i+1:04d}",
                        created_by=user,
                    )
                    summary["ledger"] += 1

            suppliers = []
            for i in range(sup_n):
                sup, created = PharmacySupplier.objects.get_or_create(
                    pharmacy=pharmacy,
                    name=f"SEED {tag} SUPPLIER {i+1:03d}",
                    defaults={
                        "phone": f"9{idx+3}{i+2}{rng.randint(1000000, 9999999)}"[:10],
                        "gst_number": f"27SUP{tag}{i+1:03d}",
                        "address": f"{BRANCH_LABELS[idx][1]} Supplier Lane {i+1}",
                        "is_active": True,
                    },
                )
                suppliers.append(sup)
                if created:
                    summary["suppliers"] += 1

            for i in range(challan_n):
                ch, created = PharmacyPurchaseChallan.objects.get_or_create(
                    pharmacy=pharmacy,
                    challan_no=f"SEED-{tag}-PC-{today.year}-{i+1:04d}",
                    defaults={
                        "supplier": suppliers[i % len(suppliers)],
                        "supplier_name_snapshot": suppliers[i % len(suppliers)].name,
                        "purchase_date": today - timedelta(days=rng.randint(1, 90)),
                        "payment_type": rng.choice(["cash", "credit", "upi"]),
                        "gst_enabled": True,
                        "created_by": user,
                    },
                )
                if created:
                    summary["challans"] += 1
                    line_count = 1 + (i % 3)
                    taxable = Decimal("0.00")
                    challan_total = Decimal("0.00")
                    for li in range(line_count):
                        b = batches[(i + li) % len(batches)]
                        pack_qty = Decimal(str(rng.randint(1, 8)))
                        rate = Decimal(str(rng.randint(30, 200)))
                        line_taxable = (pack_qty * rate).quantize(Decimal("0.01"))
                        gst_percent = Decimal(str(rng.choice([5, 12])))
                        gst_amt = (line_taxable * gst_percent / Decimal("100")).quantize(Decimal("0.01"))
                        final = (line_taxable + gst_amt).quantize(Decimal("0.01"))
                        PharmacyPurchaseChallanLine.objects.create(
                            challan=ch,
                            medicine=b.medicine,
                            batch=b,
                            quantity_basis="pack",
                            pack_type="strip",
                            conversion=Decimal("1"),
                            pack_quantity=pack_qty,
                            base_qty=pack_qty,
                            rate_type="STRIP",
                            purchase_rate=rate,
                            mrp=b.mrp,
                            sale_rate=b.sale_rate,
                            discount=Decimal("0"),
                            gst_type="exclusive",
                            gst_percent=gst_percent,
                            no_gst=False,
                            taxable_amount=line_taxable,
                            gst_amount=gst_amt,
                            final_amount=final,
                        )
                        taxable += line_taxable
                        challan_total += final
                    ch.total_items = line_count
                    ch.total_strips = Decimal(str(line_count))
                    ch.total_base_qty = ch.total_strips
                    ch.total_taxable = taxable
                    ch.total_amount = challan_total
                    ch.save(
                        update_fields=[
                            "total_items",
                            "total_strips",
                            "total_base_qty",
                            "total_taxable",
                            "total_amount",
                            "updated_at",
                        ]
                    )

            patients = []
            for i in range(patient_n):
                code = f"SEED-{pharmacy.id.hex[:6].upper()}-{i+1:04d}"
                patient, created = Patient.objects.get_or_create(
                    hospital=hospital,
                    uhid=code,
                    defaults={
                        "first_name": f"{BRANCH_LABELS[idx][1]}P{i+1:03d}",
                        "last_name": "Demo",
                        "gender": rng.choice([Patient.Gender.MALE, Patient.Gender.FEMALE, Patient.Gender.OTHER]),
                        "phone": f"9{rng.randint(100000000, 999999999)}"[:10],
                    },
                )
                patients.append(patient)
                if created:
                    summary["patients"] += 1

            # ensure invoices + items budget
            invoice_items_target = inv_item_n
            invoice_items_done = 0
            for i in range(inv_n):
                status = PharmacyInvoice.Status.DRAFT if (i % 4 == 0) else PharmacyInvoice.Status.FINALIZED
                inv_no = f"SEED-{tag}-INV-{today.year}-{i+1:05d}"
                inv, created = PharmacyInvoice.objects.get_or_create(
                    invoice_no=inv_no,
                    defaults={
                        "pharmacy": pharmacy,
                        "patient": patients[i % len(patients)],
                        "date": today - timedelta(days=rng.randint(0, 120)),
                        "status": status,
                        "gst_enabled": True,
                        "payment_method": rng.choice(["cash", "upi", "card", "credit"]),
                        "paid_amount": Decimal("0.00"),
                        "created_by": user,
                    },
                )
                if not created:
                    continue
                summary["invoices"] += 1

                line_count = 1 if invoice_items_done >= invoice_items_target else min(3, invoice_items_target - invoice_items_done)
                subtotal = Decimal("0.00")
                for li in range(max(1, line_count)):
                    b = batches[(i + li) % len(batches)]
                    qty = Decimal(str(rng.randint(1, 4)))
                    rate = b.sale_rate if b.sale_rate > 0 else Decimal("55.00")
                    amount = (qty * rate).quantize(Decimal("0.01"))
                    PharmacyInvoiceItem.objects.create(
                        invoice=inv,
                        medicine=b.medicine,
                        batch=b,
                        qty=qty,
                        mrp=b.mrp or rate,
                        rate=rate,
                        amount=amount,
                        cgst_rate=Decimal("2.50"),
                        sgst_rate=Decimal("2.50"),
                    )
                    summary["invoice_items"] += 1
                    invoice_items_done += 1
                    subtotal += amount
                gst = (subtotal * Decimal("0.05")).quantize(Decimal("0.01"))
                half = (gst / Decimal("2")).quantize(Decimal("0.01"))
                inv.subtotal = subtotal
                inv.cgst = half
                inv.sgst = gst - half
                inv.grand_total = (subtotal + gst).quantize(Decimal("0.01"))
                inv.total_discount = Decimal("0.00")
                inv.paid_amount = inv.grand_total if inv.status == PharmacyInvoice.Status.FINALIZED else Decimal("0.00")
                inv.save(
                    update_fields=[
                        "subtotal",
                        "cgst",
                        "sgst",
                        "grand_total",
                        "total_discount",
                        "paid_amount",
                        "updated_at",
                    ]
                )

        total_created = sum(summary[k] for k in budgets)
        self.stdout.write(self.style.SUCCESS("Pharmacy multi-branch seed complete."))
        self.stdout.write(f"Target records: {total} | Created core records: {total_created}")
        self.stdout.write(
            "Created -> "
            f"settings: {summary['settings']}, categories: {summary['categories']}, medicines: {summary['medicines']}, "
            f"batches: {summary['batches']}, stock_ledger: {summary['ledger']}, suppliers: {summary['suppliers']}, "
            f"challans: {summary['challans']}, invoices: {summary['invoices']}, invoice_items: {summary['invoice_items']}, "
            f"patients: {summary['patients']}"
        )

