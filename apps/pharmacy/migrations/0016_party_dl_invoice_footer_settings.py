from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pharmacy", "0015_pharmacyoutletsettings_invoice_config"),
    ]

    operations = [
        migrations.AddField(
            model_name="pharmacysupplier",
            name="dl_number",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Party drug license number for B2B invoices.",
                max_length=80,
            ),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="bank_account_no",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="bank_branch",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="bank_ifsc",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="bank_name",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="invoice_terms",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Terms & conditions printed on pharmacy invoices (one line per row in the editor).",
            ),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="signature",
            field=models.ImageField(blank=True, null=True, upload_to="pharmacy/signatures/"),
        ),
    ]
