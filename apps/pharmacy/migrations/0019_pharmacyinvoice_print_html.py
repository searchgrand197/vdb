from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pharmacy", "0018_alter_pharmacyinvoiceitem_free_qty"),
    ]

    operations = [
        migrations.AddField(
            model_name="pharmacyinvoice",
            name="print_html",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Snapshot of the invoice HTML after pre-print edits (if any).",
            ),
        ),
        migrations.AddField(
            model_name="pharmacyinvoice",
            name="print_html_updated_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="When the print snapshot was last saved.",
            ),
        ),
    ]
