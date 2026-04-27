from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0008_alter_medicinecategory_rule_type"),
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
            index=models.Index(fields=["hospital", "parent"], name="inventory_m_hospita_49d733_idx"),
        ),
    ]
