from django.db import migrations, models

from apps.settings_management.document_number_service import DEFAULT_DOCUMENT_NUMBER_FORMATS


def seed_document_number_formats(apps, schema_editor):
    ReceptionPortalSettings = apps.get_model("settings_management", "ReceptionPortalSettings")
    for row in ReceptionPortalSettings.objects.all():
        if not row.document_number_formats:
            row.document_number_formats = DEFAULT_DOCUMENT_NUMBER_FORMATS
            row.save(update_fields=["document_number_formats"])


class Migration(migrations.Migration):

    dependencies = [
        ("settings_management", "0014_receptionportalsettings_time_display_mode"),
    ]

    operations = [
        migrations.AddField(
            model_name="receptionportalsettings",
            name="document_number_formats",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Per-document number format templates (uhid, opd, ipd, payment_slip, receipt, ipd_*).",
            ),
        ),
        migrations.RunPython(seed_document_number_formats, migrations.RunPython.noop),
    ]
