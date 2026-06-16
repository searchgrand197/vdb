"""Helpers for pharmacy sale margin when batch inventory rows are removed."""

from decimal import Decimal

from django.db.models import Q

ZERO = Decimal("0")


def _challan_unit_cost(medicine_id, batch_no: str):
    if not medicine_id or not (batch_no or "").strip():
        return None
    from apps.pharmacy.models import PharmacyPurchaseChallanLine

    line = (
        PharmacyPurchaseChallanLine.objects.filter(medicine_id=medicine_id)
        .filter(Q(snapshot_batch_no=batch_no) | Q(batch__batch_no=batch_no))
        .exclude(purchase_rate=ZERO)
        .order_by("-created_at")
        .first()
    )
    if line and line.purchase_rate and line.purchase_rate > ZERO:
        return line.purchase_rate
    return None


def _sibling_snapshot_unit_cost(medicine_id, batch_no: str, exclude_item_id=None):
    if not medicine_id or not (batch_no or "").strip():
        return None
    from apps.pharmacy.models import PharmacyInvoiceItem

    qs = (
        PharmacyInvoiceItem.objects.filter(medicine_id=medicine_id, snapshot_batch_no=batch_no)
        .exclude(snapshot_unit_cost=ZERO)
        .order_by("-created_at")
    )
    if exclude_item_id:
        qs = qs.exclude(pk=exclude_item_id)
    sib = qs.first()
    if sib and sib.snapshot_unit_cost and sib.snapshot_unit_cost > ZERO:
        return sib.snapshot_unit_cost
    return None


def _item_batch_no(item) -> str:
    if item.batch_id and item.batch:
        return (item.batch.batch_no or "").strip()
    return (item.snapshot_batch_no or "").strip()


def resolve_invoice_item_unit_cost(item):
    """
    Return per-unit purchase cost for margin, or None if unknown.
    Falls back to purchase challan / sibling invoice lines when batch is gone.
    """
    if item.batch_id and item.batch:
        cost = item.batch.unit_cost
        if cost is not None and cost > ZERO:
            return cost

    snap = getattr(item, "snapshot_unit_cost", None)
    if snap is not None and snap > ZERO:
        return snap

    batch_no = _item_batch_no(item)
    if item.medicine_id:
        challan_cost = _challan_unit_cost(item.medicine_id, batch_no)
        if challan_cost is not None:
            return challan_cost
        sibling_cost = _sibling_snapshot_unit_cost(item.medicine_id, batch_no, exclude_item_id=item.pk)
        if sibling_cost is not None:
            return sibling_cost

    return None


def batch_unit_cost_for_snapshot(batch):
    """Best available unit cost to persist on invoice lines when a batch is deleted."""
    if batch.unit_cost and batch.unit_cost > ZERO:
        return batch.unit_cost
    challan_cost = _challan_unit_cost(batch.medicine_id, batch.batch_no)
    if challan_cost is not None:
        return challan_cost
    return batch.unit_cost or ZERO
