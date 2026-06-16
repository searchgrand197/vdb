from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("pharmacy", "0021_split_b2b_b2c_outlet_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="pharmacyinvoice",
            name="cancel_reason",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="pharmacyinvoice",
            name="cancelled_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="pharmacyinvoice",
            name="cancelled_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="cancelled_pharmacy_invoices",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
