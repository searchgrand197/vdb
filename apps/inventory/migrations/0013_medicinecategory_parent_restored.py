from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0012_remove_medicinecategory_inventory_m_hospita_9e2c78_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="medicinecategory",
            name="parent",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="subcategories",
                to="inventory.medicinecategory",
            ),
        ),
        migrations.AddIndex(
            model_name="medicinecategory",
            index=models.Index(fields=["pharmacy", "parent"], name="inventory_m_pharmac_parent_idx"),
        ),
    ]
