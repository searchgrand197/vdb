from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pharmacy", "0014_low_stock_threshold"),
    ]

    operations = [
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="invoice_next_number",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="invoice_prefix",
            field=models.CharField(blank=True, default="INV", max_length=20),
        ),
    ]
