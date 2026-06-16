from decimal import Decimal

from django.db import migrations
from django.db.models import Q


def _challan_unit_cost(ChallanLine, medicine_id, batch_no):
    if not medicine_id or not (batch_no or "").strip():
        return None
    line = (
        ChallanLine.objects.filter(medicine_id=medicine_id)
        .filter(Q(snapshot_batch_no=batch_no) | Q(batch__batch_no=batch_no))
        .exclude(purchase_rate=Decimal("0"))
        .order_by("-created_at")
        .first()
    )
    if line and line.purchase_rate and line.purchase_rate > Decimal("0"):
        return line.purchase_rate
    return None


def backfill_missing_snapshot_unit_cost(apps, schema_editor):
    Item = apps.get_model("pharmacy", "PharmacyInvoiceItem")
    Batch = apps.get_model("inventory", "MedicineBatch")
    ChallanLine = apps.get_model("pharmacy", "PharmacyPurchaseChallanLine")

    for row in Item.objects.filter(snapshot_unit_cost=Decimal("0")).iterator(chunk_size=300):
        cost = None
        if row.batch_id:
            try:
                b = Batch.objects.get(pk=row.batch_id)
            except Batch.DoesNotExist:
                b = None
            if b is not None and b.unit_cost and b.unit_cost > Decimal("0"):
                cost = b.unit_cost
        batch_no = (row.snapshot_batch_no or "").strip()
        if cost is None and batch_no and row.medicine_id:
            cost = _challan_unit_cost(ChallanLine, row.medicine_id, batch_no)
        if cost is None and batch_no and row.medicine_id:
            sib = (
                Item.objects.filter(medicine_id=row.medicine_id, snapshot_batch_no=batch_no)
                .exclude(snapshot_unit_cost=Decimal("0"))
                .order_by("-created_at")
                .first()
            )
            if sib:
                cost = sib.snapshot_unit_cost
        if cost is not None and cost > Decimal("0"):
            Item.objects.filter(pk=row.pk).update(snapshot_unit_cost=cost)


class Migration(migrations.Migration):
    dependencies = [
        ("pharmacy", "0024_pharmacyinvoiceitem_snapshot_unit_cost"),
    ]

    operations = [
        migrations.RunPython(backfill_missing_snapshot_unit_cost, migrations.RunPython.noop),
    ]
