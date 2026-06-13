from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pharmacy", "0016_party_dl_invoice_footer_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="default_sale_gst_enabled",
            field=models.BooleanField(
                default=False,
                help_text="Default GST on/off when opening the sales screen.",
            ),
        ),
        migrations.AddField(
            model_name="pharmacyinvoice",
            name="billing_doctor_name",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Walk-in / out-of-hospital doctor name snapshot for invoice print.",
                max_length=200,
            ),
        ),
        migrations.AddField(
            model_name="pharmacyinvoice",
            name="billing_hospital_name",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Walk-in / out-of-hospital hospital name snapshot for invoice print.",
                max_length=200,
            ),
        ),
        migrations.AddField(
            model_name="pharmacyinvoiceitem",
            name="free_qty",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Complimentary base units (not taxed); stock is qty + free_qty.",
                max_digits=12,
            ),
        ),
    ]
