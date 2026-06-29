from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, List, Sequence, Tuple

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


def _stock_qty_from_parts(qty, free_qty) -> Decimal:
    return Decimal(qty or 0) + Decimal(free_qty or 0)


def _aggregate_old_items_by_batch(*, pharmacy: Pharmacy, old_items) -> Dict[str, Decimal]:
    by_batch: Dict[str, Decimal] = defaultdict(Decimal)
    for item in old_items:
        stock_qty = _stock_qty_from_parts(item.qty, item.free_qty)
        if stock_qty <= 0:
            continue
        batch = _resolve_item_batch_for_restore(pharmacy=pharmacy, item=item)
        if batch is None:
            med_name = getattr(item.medicine, "name", None) or str(item.medicine_id)
            batch_hint = (item.snapshot_batch_no or "").strip() or "—"
            raise ValueError(
                f"Cannot restore stock for {med_name} (batch {batch_hint}): batch not found."
            )
        by_batch[str(batch.id)] += stock_qty
    return dict(by_batch)


def _aggregate_new_rows_by_batch(new_rows) -> Tuple[Dict[str, Decimal], set]:
    by_batch: Dict[str, Decimal] = defaultdict(Decimal)
    batch_ids: set = set()
    for row in new_rows:
        batch_id = row.get("batch")
        medicine_id = row.get("medicine")
        qty = Decimal(str(row.get("qty", 0) or 0))
        free_qty = Decimal(str(row.get("free_qty", 0) or 0))
        if not batch_id or not medicine_id:
            continue
        stock_qty = qty + free_qty
        if stock_qty <= 0:
            continue
        bid = str(batch_id)
        by_batch[bid] += stock_qty
        batch_ids.add(bid)
    return dict(by_batch), batch_ids


def reconcile_stock_for_invoice_edit(
    *,
    request,
    pharmacy: Pharmacy,
    old_items,
    new_rows,
    reference_id: str = "",
) -> None:
    """Adjust stock ledger when a finalized pharmacy invoice is edited."""
    user = getattr(request, "user", None)
    created_by = user if getattr(user, "is_authenticated", False) else None
    if created_by is None:
        raise ValueError("Authentication required for stock reconciliation.")

    old_by_batch = _aggregate_old_items_by_batch(pharmacy=pharmacy, old_items=old_items)
    new_by_batch, new_batch_ids = _aggregate_new_rows_by_batch(new_rows)

    all_batch_ids = set(old_by_batch) | set(new_by_batch) | new_batch_ids
    batches_by_id = {
        str(b.id): b
        for b in MedicineBatch.objects.filter(pharmacy_id=pharmacy.id, id__in=all_batch_ids)
    }

    ref = reference_id or ""
    restores: List[Tuple[MedicineBatch, Decimal]] = []
    deductions: List[Tuple[MedicineBatch, Decimal]] = []

    for batch_id in all_batch_ids:
        old_qty = old_by_batch.get(batch_id, Decimal("0"))
        new_qty = new_by_batch.get(batch_id, Decimal("0"))
        delta = new_qty - old_qty
        if delta == 0:
            continue
        batch = batches_by_id.get(batch_id)
        if batch is None:
            raise ValueError(f"Cannot reconcile stock: batch {batch_id} not found.")
        if delta < 0:
            restores.append((batch, -delta))
        else:
            deductions.append((batch, delta))

    for batch, restore_qty in restores:
        StockLedger.objects.create(
            pharmacy_id=pharmacy.id,
            medicine_id=batch.medicine_id,
            batch_id=batch.id,
            qty_change=restore_qty,
            reason=StockLedger.Reason.RETURN_IN,
            reference_type="pharmacy_edit",
            reference_id=ref,
            created_by=created_by,
        )

    if deductions:
        deduct_stock_fifo(
            request=request,
            pharmacy=pharmacy,
            medicine_batch_pairs=deductions,
            reference_id=ref,
        )

