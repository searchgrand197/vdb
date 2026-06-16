from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import List, Sequence, Tuple

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.inventory.models import MedicineBatch, StockLedger
from apps.pharmacy.models import Pharmacy, PharmacyInvoiceItem


@dataclass(frozen=True)
class BatchDeduction:
    batch_id: str
    qty: Decimal


def get_batch_available_qty(batch: MedicineBatch) -> Decimal:
    total = (
        StockLedger.objects.filter(pharmacy_id=batch.pharmacy_id, batch_id=batch.id)
        .aggregate(s=Sum("qty_change"))
        .get("s")
    )
    return total or Decimal("0")


def deduct_stock_fifo(
    *,
    request,
    pharmacy: Pharmacy,
    medicine_batch_pairs: Sequence[Tuple[MedicineBatch, Decimal]],
    reference_id: str = "",
) -> None:
    """
    Deducts stock by writing ledger entries.

    This function expects you to already decide which batches and quantities to deduct.
    """

    user = getattr(request, "user", None)
    created_by = user if getattr(user, "is_authenticated", False) else None
    if created_by is None:
        raise ValueError("Authentication required for stock deduction.")

    for batch, qty in medicine_batch_pairs:
        qty = Decimal(qty)
        if qty <= 0:
            continue

        available = get_batch_available_qty(batch)
        if available < qty:
            raise ValueError(f"Insufficient stock for batch={batch.batch_no}. Available={available} requested={qty}")

        StockLedger.objects.create(
            pharmacy_id=pharmacy.id,
            medicine_id=batch.medicine_id,
            batch_id=batch.id,
            qty_change=(-qty),
            reason=StockLedger.Reason.DISPENSE_OUT,
            reference_type="pharmacy_dispense",
            reference_id=reference_id or "",
            created_by=created_by,
        )


def deduct_stock_for_medicine_fifo(*, request, pharmacy: Pharmacy, medicine_id, qty_needed: Decimal, max_batches: int = 50) -> List[BatchDeduction]:
    """
    Deducts required qty from earliest expiry batches (FIFO).
    """

    qty_needed = Decimal(qty_needed)
    if qty_needed <= 0:
        return []

    user = getattr(request, "user", None)
    created_by = user if getattr(user, "is_authenticated", False) else None
    if created_by is None:
        raise ValueError("Authentication required for stock deduction.")

    with transaction.atomic():
        batches = (
            MedicineBatch.objects.select_related("medicine", "pharmacy")
            .filter(pharmacy_id=pharmacy.id, medicine_id=medicine_id)
            .order_by("expiry_date", "created_at")
        )[:max_batches]

        remaining = qty_needed
        deductions: List[Tuple[MedicineBatch, Decimal]] = []

        # Lock ledger by relying on transactional atomic; deeper locking can be added per DB.
        for batch in batches:
            if remaining <= 0:
                break
            available = get_batch_available_qty(batch)
            if available <= 0:
                continue
            use_qty = min(available, remaining)
            deductions.append((batch, use_qty))
            remaining -= use_qty

        if remaining > 0:
            raise ValueError(f"Insufficient stock. Remaining qty={remaining}")

        deduct_stock_fifo(request=request, pharmacy=pharmacy, medicine_batch_pairs=deductions, reference_id="")

    return [BatchDeduction(batch_id=str(b.id), qty=q) for b, q in deductions]


def _resolve_item_batch_for_restore(*, pharmacy: Pharmacy, item: PharmacyInvoiceItem) -> MedicineBatch | None:
    batch = item.batch
    if batch is not None:
        return batch
    snapshot_no = (item.snapshot_batch_no or "").strip()
    if not snapshot_no:
        return None
    return (
        MedicineBatch.objects.filter(
            pharmacy_id=pharmacy.id,
            medicine_id=item.medicine_id,
            batch_no=snapshot_no,
        )
        .order_by("-created_at")
        .first()
    )


def restore_stock_for_invoice_cancel(
    *,
    request,
    pharmacy: Pharmacy,
    items,
    reference_id: str = "",
) -> None:
    """Return dispensed stock when a finalized pharmacy invoice is cancelled."""
    user = getattr(request, "user", None)
    created_by = user if getattr(user, "is_authenticated", False) else None
    if created_by is None:
        raise ValueError("Authentication required for stock restoration.")

    ref = reference_id or ""
    for item in items:
        restore_qty = Decimal(item.qty or 0) + Decimal(item.free_qty or 0)
        if restore_qty <= 0:
            continue
        batch = _resolve_item_batch_for_restore(pharmacy=pharmacy, item=item)
        if batch is None:
            med_name = getattr(item.medicine, "name", None) or str(item.medicine_id)
            batch_hint = (item.snapshot_batch_no or "").strip() or "—"
            raise ValueError(
                f"Cannot restore stock for {med_name} (batch {batch_hint}): batch not found."
            )
        StockLedger.objects.create(
            pharmacy_id=pharmacy.id,
            medicine_id=batch.medicine_id,
            batch_id=batch.id,
            qty_change=restore_qty,
            reason=StockLedger.Reason.RETURN_IN,
            reference_type="pharmacy_cancel",
            reference_id=ref,
            created_by=created_by,
        )

