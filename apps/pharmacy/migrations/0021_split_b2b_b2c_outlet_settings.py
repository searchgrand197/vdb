from decimal import Decimal

from django.db import migrations, models


def copy_legacy_to_channels(apps, schema_editor):
    PharmacyOutletSettings = apps.get_model("pharmacy", "PharmacyOutletSettings")
    dup_fields = (
        "address",
        "mobile",
        "gst_number",
        "dl_number",
        "email",
        "website",
        "invoice_prefix",
        "invoice_next_number",
        "default_gst_percent",
        "default_sale_gst_enabled",
        "sale_bill_qty_display",
        "bank_name",
        "bank_branch",
        "bank_account_no",
        "bank_ifsc",
        "invoice_terms",
    )
    for row in PharmacyOutletSettings.objects.all():
        changed = []
        for field in dup_fields:
            val = getattr(row, field, None)
            if val is None:
                continue
            for prefix in ("b2c", "b2b"):
                setattr(row, f"{prefix}_{field}", val)
                changed.append(f"{prefix}_{field}")
        if getattr(row, "default_sale_discount_percent", None) is not None:
            row.b2c_default_sale_discount_percent = row.default_sale_discount_percent
            changed.append("b2c_default_sale_discount_percent")
        if getattr(row, "low_stock_threshold", None) is not None:
            row.b2c_low_stock_threshold = row.low_stock_threshold
            changed.append("b2c_low_stock_threshold")
        if getattr(row, "signature", None):
            row.b2c_signature = row.signature
            row.b2b_signature = row.signature
            changed.extend(["b2c_signature", "b2b_signature"])
        if changed:
            row.save(update_fields=changed)


class Migration(migrations.Migration):

    dependencies = [
        ("pharmacy", "0020_pharmacyoutletsettings_sale_bill_qty_display"),
    ]

    operations = [
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_address",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_mobile",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_gst_number",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_dl_number",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_email",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_website",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_invoice_prefix",
            field=models.CharField(blank=True, default="INV", max_length=20),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_invoice_next_number",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_default_gst_percent",
            field=models.DecimalField(decimal_places=2, default=Decimal("5.00"), max_digits=5),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_default_sale_discount_percent",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=5),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_default_sale_gst_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_sale_bill_qty_display",
            field=models.CharField(
                choices=[("base_units", "Base units"), ("pack_and_loose", "Packs + loose")],
                default="base_units",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_low_stock_threshold",
            field=models.PositiveIntegerField(default=10),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_bank_name",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_bank_branch",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_bank_account_no",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_bank_ifsc",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_invoice_terms",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2c_signature",
            field=models.ImageField(blank=True, null=True, upload_to="pharmacy/signatures/b2c/"),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_address",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_mobile",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_gst_number",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_dl_number",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_email",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_website",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_invoice_prefix",
            field=models.CharField(blank=True, default="INV", max_length=20),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_invoice_next_number",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_default_gst_percent",
            field=models.DecimalField(decimal_places=2, default=Decimal("5.00"), max_digits=5),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_default_sale_gst_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_sale_bill_qty_display",
            field=models.CharField(
                choices=[("base_units", "Base units"), ("pack_and_loose", "Packs + loose")],
                default="base_units",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_bank_name",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_bank_branch",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_bank_account_no",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_bank_ifsc",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_invoice_terms",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_signature",
            field=models.ImageField(blank=True, null=True, upload_to="pharmacy/signatures/b2b/"),
        ),
        migrations.RunPython(copy_legacy_to_channels, migrations.RunPython.noop),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="address"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="mobile"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="gst_number"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="dl_number"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="email"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="website"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="invoice_prefix"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="invoice_next_number"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="default_gst_percent"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="default_sale_discount_percent"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="default_sale_gst_enabled"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="sale_bill_qty_display"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="low_stock_threshold"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="bank_name"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="bank_branch"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="bank_account_no"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="bank_ifsc"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="invoice_terms"),
        migrations.RemoveField(model_name="pharmacyoutletsettings", name="signature"),
    ]
