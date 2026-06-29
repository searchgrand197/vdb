"""
Migration 0026: Fix snapshot_unit_cost=0 items whose batch has unit_cost=0
but whose purchase challan has the real cost.

This runs automatically on 'python manage.py migrate' — no manual steps needed.

Covers two cases left unresolved by migration 0025:
  1. Batch still alive but unit_cost=0  → look up challan by batch.batch_no
  2. Batch deleted (batch_id=None)      → re-try challan using snapshot_batch_no
     (0025 may have missed these if the challan had no snapshot_batch_no set yet)
"""

from decimal import Decimal

from django.db import migrations
from django.db.models import Q


ZERO = Decimal("0")


def _challan_cost(ChallanLine, medicine_id, batch_no):
    if not medicine_id or not (batch_no or "").strip():
        return None
    line = (
        ChallanLine.objects.filter(medicine_id=medicine_id)
        .filter(
            Q(snapshot_batch_no=batch_no) | Q(batch__batch_no=batch_no)
        )
        .exclude(purchase_rate=ZERO)
        .order_by("-created_at")
        .first()
    )
    if line and line.purchase_rate and line.purchase_rate > ZERO:
        return line.purchase_rate
    return None


def _sibling_cost(Item, medicine_id, batch_no, exclude_pk):
    """Another invoice item for the same medicine+batch that has a non-zero cost."""
    if not medicine_id or not (batch_no or "").strip():
        return None
    sib = (
        Item.objects.filter(medicine_id=medicine_id, snapshot_batch_no=batch_no)
        .exclude(snapshot_unit_cost=ZERO)
        .exclude(pk=exclude_pk)
        .order_by("-created_at")
        .first()
    )
    if sib and sib.snapshot_unit_cost and sib.snapshot_unit_cost > ZERO:
        return sib.snapshot_unit_cost
    return None


def fix_zero_snapshot_unit_costs(apps, schema_editor):
    Item = apps.get_model("pharmacy", "PharmacyInvoiceItem")
    Batch = apps.get_model("inventory", "MedicineBatch")
    ChallanLine = apps.get_model("pharmacy", "PharmacyPurchaseChallanLine")

    updates = []

    for row in (
        Item.objects.filter(
            Q(snapshot_unit_cost__isnull=True) | Q(snapshot_unit_cost=ZERO)
        )
        .iterator(chunk_size=400)
    ):
        cost = None

        # --- Case 1: batch still alive but unit_cost=0 ---
        if row.batch_id:
            try:
                batch = Batch.objects.get(pk=row.batch_id)
            except Batch.DoesNotExist:
                batch = None

            if batch is not None:
                if batch.unit_cost and batch.unit_cost > ZERO:
                    cost = batch.unit_cost
                else:
                    # Batch exists but unit_cost=0 → try challan by batch_no
                    bn = (batch.batch_no or "").strip()
                    if bn and row.medicine_id:
                        cost = _challan_cost(ChallanLine, row.medicine_id, bn)

        # --- Case 2: batch deleted, try snapshot_batch_no ---
        if cost is None:
            bn = (row.snapshot_batch_no or "").strip()
            if bn and row.medicine_id:
                cost = _challan_cost(ChallanLine, row.medicine_id, bn)

        # --- Case 3: sibling invoice item with same medicine+batch ---
        if cost is None:
            bn = (row.snapshot_batch_no or "").strip()
            if bn and row.medicine_id:
                cost = _sibling_cost(Item, row.medicine_id, bn, exclude_pk=row.pk)

        if cost is not None and cost > ZERO:
            updates.append((row.pk, cost))

        # Flush in batches of 400 to avoid memory buildup
        if len(updates) >= 400:
            for pk, c in updates:
                Item.objects.filter(pk=pk).update(snapshot_unit_cost=c)
            updates.clear()

    # Final flush
    for pk, c in updates:
        Item.objects.filter(pk=pk).update(snapshot_unit_cost=c)


class Migration(migrations.Migration):

    dependencies = [
        ("pharmacy", "0025_backfill_snapshot_unit_cost"),
        ("inventory", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            fix_zero_snapshot_unit_costs,
            migrations.RunPython.noop,  # reverse: do nothing (safe)
        ),
    ]
