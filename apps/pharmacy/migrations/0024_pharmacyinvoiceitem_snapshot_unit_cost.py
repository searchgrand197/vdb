from decimal import Decimal

from django.db import migrations, models


def backfill_snapshot_unit_cost(apps, schema_editor):
    Item = apps.get_model("pharmacy", "PharmacyInvoiceItem")
    Batch = apps.get_model("inventory", "MedicineBatch")
    for row in Item.objects.exclude(batch_id__isnull=True).iterator(chunk_size=300):
        try:
            b = Batch.objects.get(pk=row.batch_id)
        except Batch.DoesNotExist:
            continue
        if b.unit_cost and b.unit_cost > Decimal("0"):
            Item.objects.filter(pk=row.pk).update(snapshot_unit_cost=b.unit_cost)


class Migration(migrations.Migration):
    dependencies = [
        ("pharmacy", "0023_voided_field"),
        ("inventory", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="pharmacyinvoiceitem",
            name="snapshot_unit_cost",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                help_text="Purchase cost per unit at sale time; kept when batch is deleted.",
                max_digits=12,
            ),
        ),
        migrations.RunPython(backfill_snapshot_unit_cost, migrations.RunPython.noop),
    ]
