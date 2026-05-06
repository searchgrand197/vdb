from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0015_medicinecategory_color"),
        ("pharmacy", "0012_pharmacy_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="medicine",
            name="category",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="medicines",
                to="inventory.medicinecategory",
            ),
        ),
    ]

