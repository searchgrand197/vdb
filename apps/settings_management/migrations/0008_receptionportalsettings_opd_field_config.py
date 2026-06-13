from django.db import migrations, models

CORE_LABELS = {
    "phone": "Phone or UHID",
    "patient_name": "Patient Name",
    "guardian": "Guardian",
    "age": "Age",
    "gender": "Gender",
    "address": "Address",
    "doctor": "Doctor",
    "department": "Department",
    "amount": "Amount",
    "chief_complaint": "Chief Complaint",
}


def forwards_populate_opd_field_config(apps, schema_editor):
    ReceptionPortalSettings = apps.get_model("settings_management", "ReceptionPortalSettings")
    for row in ReceptionPortalSettings.objects.all().iterator():
        hidden = set(row.opd_visible_fields if isinstance(row.opd_visible_fields, list) else [])
        row.opd_field_config = {
            key: {
                "createForm": key not in hidden,
                "slip": True,
                "showLabel": True,
                "label": CORE_LABELS[key],
            }
            for key in CORE_LABELS
        }
        row.save(update_fields=["opd_field_config"])


class Migration(migrations.Migration):

    dependencies = [
        ("settings_management", "0007_receptionportalsettings_opd_visible_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="receptionportalsettings",
            name="opd_field_config",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RunPython(forwards_populate_opd_field_config, migrations.RunPython.noop),
    ]
