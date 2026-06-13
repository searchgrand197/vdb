"""Purchase challan: create/update batches and stock-in ledger lines (Marg-style amounts)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.auditlogs.services import create_audit_log
from apps.inventory.models import Medicine, MedicineBatch, StockLedger
from apps.pharmacy.calculations import compute_marg_gst_on_base, normalize_gst_type
from apps.pharmacy.models import (
    PharmacyOutletSettings,
    PharmacyPurchaseChallan,
    PharmacyPurchaseChallanLine,
    PharmacySupplier,
)
from apps.shared.models import Hospital


def _merge_unit_conversion(medicine: Medicine, pack_type: str, conversion: Decimal) -> None:
    key = (pack_type or "").strip().lower()
    if not key:
        return
    conv = medicine.unit_conversions or {}
    conv[key] = float(conversion)
    medicine.unit_conversions = conv
    medicine.save(update_fields=["unit_conversions", "updated_at"])


def _resolve_rate_type(raw: dict[str, Any], basis: str) -> str:
    rt = (raw.get("rate_type") or "").strip().upper()
    if rt in ("STRIP", "TABLET"):
        return rt
    return "STRIP" if basis == "pack" else "TABLET"


def _to_per_base_price(value: Decimal, *, basis: str, conversion: Decimal) -> Decimal:
    """Normalize pack-entered price fields to per-base-unit values for storage."""
    v = Decimal(value)
    if basis != "pack":
        return v
    if conversion <= 0:
        return v
    return (v / conversion).quantize(Decimal("0.01"))


@transaction.atomic
def process_purchase_challan(
    *,
    request,
    hospital: Hospital,
    lines: list[dict[str, Any]],
    supplier_id: Any | None = None,
    invoice_no: str = "",
    purchase_date: date | None = None,
    payment_type: str = "cash",
    gst_enabled: bool = True,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    today = timezone.now().date()
    purchase_date = purchase_date or today

    supplier_name_snapshot = ""
    if supplier_id is not None:
        try:
            sup = PharmacySupplier.objects.get(pk=supplier_id, hospital_id=hospital.id, is_active=True)
            supplier_name_snapshot = (sup.name or "")[:200]
        except PharmacySupplier.DoesNotExist as exc:
            raise ValueError("Unknown or inactive supplier for this hospital.") from exc

    challan = PharmacyPurchaseChallan.objects.create(
        hospital=hospital,
        supplier_id=supplier_id,
        supplier_name_snapshot=supplier_name_snapshot,
        challan_no=(invoice_no or "")[:120],
        purchase_date=purchase_date,
        payment_type=(payment_type or "cash")[:20],
        gst_enabled=gst_enabled,
        created_by=request.user,
    )
    ref_id = str(challan.id)[:100]

    total_final = Decimal("0")
    total_taxable = Decimal("0")
    total_strips = Decimal("0")
    total_extra_tablets = Decimal("0")
    total_base_sum = Decimal("0")

    default_gst = Decimal("5")
    pharmacy = getattr(request, "pharmacy", None)
    if pharmacy is not None:
        default_row = PharmacyOutletSettings.objects.filter(pharmacy_id=pharmacy.id).values_list(
            "b2c_default_gst_percent", flat=True
        ).first()
        if default_row is not None:
            default_gst = Decimal(str(default_row))

    for raw in lines:
        try:
            medicine = Medicine.objects.select_related("unit").get(pk=raw["medicine"])
        except Medicine.DoesNotExist as exc:
            raise ValueError("Unknown medicine id.") from exc
        if medicine.hospital_id != hospital.id:
            raise ValueError(
                "Medicine does not belong to your hospital. "
                "Use medicines created for this site, or assign your user to the correct hospital."
            )
        batch_no = raw["batch_no"].strip()
        if not batch_no:
            raise ValueError("Batch is required.")
        expiry_date = raw["expiry_date"]
        if expiry_date < today:
            raise ValueError(f"Expiry date must be today or later for batch {batch_no}.")

        qty_val = Decimal(raw["quantity"])
        conversion = Decimal(raw.get("conversion") or "1")
        basis = (raw.get("quantity_basis") or "pack").strip().lower()
        if basis not in ("pack", "base"):
            basis = "pack"

        purchase_rate = Decimal(raw["purchase_rate"])
        if purchase_rate <= 0:
            raise ValueError("Purchase rate must be greater than zero.")

        if basis == "base":
            if qty_val <= 0:
                raise ValueError("Quantity must be greater than zero.")
            total_qty = qty_val.quantize(Decimal("0.001"))
            conversion = Decimal("1")
            total_extra_tablets += qty_val
        else:
            if qty_val <= 0 or conversion <= 0:
                raise ValueError("Quantity and conversion must be greater than zero.")
            total_qty = (qty_val * conversion).quantize(Decimal("0.001"))
            total_strips += qty_val
        total_base_sum += total_qty

        rate_type = _resolve_rate_type(raw, basis)
        if rate_type == "STRIP":
            line_gross = qty_val * purchase_rate
        else:
            line_gross = total_qty * purchase_rate

        mrp_input = Decimal(raw["mrp"])
        sale_rate_input = Decimal(raw.get("sale_rate") or mrp_input)
        discount = Decimal(raw.get("discount") or "0")
        no_gst = bool(raw.get("skip_gst") or raw.get("no_gst")) or (not gst_enabled)
        gst_type = normalize_gst_type(raw.get("gst_type"))
        row_gp = raw.get("gst_percent")
        if no_gst:
            eff_gst = Decimal("0")
        elif row_gp is not None:
            eff_gst = max(Decimal("0"), Decimal(str(row_gp)))
        else:
            mp = getattr(medicine, "gst_percent", None)
            eff_gst = max(Decimal("0"), Decimal(str(mp if mp is not None else default_gst)))

        amounts = compute_marg_gst_on_base(
            base_amount=line_gross,
            discount=discount,
            gst_type=gst_type,
            gst_percent=eff_gst,
            no_gst=no_gst,
        )
        taxable = amounts["taxable_amount"]
        total_final += amounts["final_amount"]
        total_taxable += taxable

        cost_per_base = (taxable / total_qty).quantize(Decimal("0.0001")) if total_qty > 0 else Decimal("0")
        mrp_per_base = _to_per_base_price(mrp_input, basis=basis, conversion=conversion)
        sale_rate_per_base = _to_per_base_price(sale_rate_input, basis=basis, conversion=conversion)
        purchase_rate_per_base = (
            _to_per_base_price(purchase_rate, basis=basis, conversion=conversion)
            if rate_type == "STRIP"
            else purchase_rate.quantize(Decimal("0.01"))
        )

        pack_key = (raw.get("pack_type") or "").strip().lower()
        if pack_key and pack_key in ("strip", "box", "carton") and conversion > 0 and basis == "pack":
            _merge_unit_conversion(medicine, pack_key, conversion)

        batch, created = MedicineBatch.objects.get_or_create(
            hospital=hospital,
            medicine=medicine,
            batch_no=batch_no,
            defaults={
                "expiry_date": expiry_date,
                "unit_cost": cost_per_base,
                "mrp": mrp_per_base,
                "sale_rate": sale_rate_per_base,
            },
        )
        if not created:
            batch.expiry_date = expiry_date
            batch.mrp = mrp_per_base
            batch.sale_rate = sale_rate_per_base
            batch.unit_cost = cost_per_base
            batch.save(update_fields=["expiry_date", "mrp", "sale_rate", "unit_cost", "updated_at"])

        PharmacyPurchaseChallanLine.objects.create(
            challan=challan,
            medicine=medicine,
            batch=batch,
            quantity_basis=basis,
            pack_type=pack_key[:40],
            conversion=conversion,
            pack_quantity=qty_val if basis == "pack" else Decimal("0"),
            base_qty=total_qty,
            rate_type=rate_type,
            purchase_rate=purchase_rate_per_base,
            mrp=mrp_per_base,
            sale_rate=sale_rate_per_base,
            discount=discount,
            gst_type=gst_type or "exclusive",
            gst_percent=eff_gst,
            no_gst=no_gst,
            taxable_amount=taxable.quantize(Decimal("0.01")),
            gst_amount=amounts["gst_amount"].quantize(Decimal("0.01")),
            final_amount=amounts["final_amount"].quantize(Decimal("0.01")),
        )

        StockLedger.objects.create(
            hospital_id=hospital.id,
            medicine_id=medicine.id,
            batch=batch,
            qty_change=total_qty,
            reason=StockLedger.Reason.STOCK_IN,
            reference_type="pharmacy_purchase_challan",
            reference_id=ref_id,
            created_by=request.user,
        )

        create_audit_log(
            request=request,
            hospital=hospital,
            module="inventory",
            action="purchase_challan_stock_in",
            obj=batch,
            after={
                "batch_no": batch.batch_no,
                "qty_base": str(total_qty),
                "rate_type": rate_type,
                "invoice_no": invoice_no,
            },
        )

        tq = str(total_qty)
        out.append(
            {
                "medicine": str(medicine.id),
                "batch_id": str(batch.id),
                "batch_no": batch.batch_no,
                "base_qty": tq,
                "total_qty": tq,
                "rate_type": rate_type,
                "taxable_amount": str(taxable),
                "gst_amount": str(amounts["gst_amount"]),
                "final_amount": str(amounts["final_amount"]),
            }
        )

    create_audit_log(
        request=request,
        hospital=hospital,
        module="pharmacy",
        action="purchase_challan_posted",
        obj=hospital,
        after={
            "supplier_id": str(supplier_id) if supplier_id else None,
            "invoice_no": invoice_no,
            "purchase_date": str(purchase_date),
            "payment_type": payment_type,
            "line_count": len(out),
            "sum_taxable": str(total_taxable.quantize(Decimal("0.01"))),
            "sum_final": str(total_final.quantize(Decimal("0.01"))),
            "challan_id": str(challan.id),
        },
    )

    challan.total_items = len(out)
    challan.total_strips = total_strips
    challan.total_extra_tablets = total_extra_tablets
    challan.total_base_qty = total_base_sum
    challan.total_taxable = total_taxable.quantize(Decimal("0.01"))
    challan.total_amount = total_final.quantize(Decimal("0.01"))
    challan.save(
        update_fields=[
            "total_items",
            "total_strips",
            "total_extra_tablets",
            "total_base_qty",
            "total_taxable",
            "total_amount",
            "updated_at",
        ]
    )

    return out
