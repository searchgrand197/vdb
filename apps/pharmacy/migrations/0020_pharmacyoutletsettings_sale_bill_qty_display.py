from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pharmacy", "0019_pharmacyinvoice_print_html"),
    ]

    operations = [
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="sale_bill_qty_display",
            field=models.CharField(
                choices=[("base_units", "Base units"), ("pack_and_loose", "Packs + loose")],
                default="base_units",
                help_text="How sold quantity appears on sales bills: base units or packs + loose.",
                max_length=20,
            ),
        ),
    ]
