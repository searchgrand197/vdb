# Generated migration for B2B sales feature

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pharmacy", "0012_pharmacy_and_more"),
    ]

    operations = [
        # Add b2b_enabled toggle to outlet settings
        migrations.AddField(
            model_name="pharmacyoutletsettings",
            name="b2b_enabled",
            field=models.BooleanField(
                default=False,
                help_text="When enabled, sales are made to business parties instead of patients.",
            ),
        ),
        # Make patient nullable on invoices (B2B invoices have no patient)
        migrations.AlterField(
            model_name="pharmacyinvoice",
            name="patient",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="pharmacy_invoices",
                to="patients.patient",
            ),
        ),
        # Add party FK (B2B sales party, reuses PharmacySupplier)
        migrations.AddField(
            model_name="pharmacyinvoice",
            name="party",
            field=models.ForeignKey(
                blank=True,
                help_text="B2B sale party (used when B2B mode is enabled instead of patient).",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="sale_invoices",
                to="pharmacy.pharmacysupplier",
            ),
        ),
        # Snapshot of party name at invoice time
        migrations.AddField(
            model_name="pharmacyinvoice",
            name="party_name_snapshot",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Party name captured at invoice time, preserved if the party is later deleted.",
                max_length=200,
            ),
        ),
    ]
