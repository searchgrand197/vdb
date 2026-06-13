from django.db import migrations

from apps.settings_management.opd_field_catalog import default_opd_field_config


def forwards_add_visit_date_core_field(apps, schema_editor):
    ReceptionPortalSettings = apps.get_model("settings_management", "ReceptionPortalSettings")
    defaults = default_opd_field_config()
    visit_date_default = defaults["visit_date"]
    for row in ReceptionPortalSettings.objects.all().iterator():
        cfg = row.opd_field_config if isinstance(row.opd_field_config, dict) else {}
        if isinstance(cfg.get("visit_date"), dict):
            continue
        next_cfg = dict(cfg)
        next_cfg["visit_date"] = dict(visit_date_default)
        row.opd_field_config = next_cfg
        row.save(update_fields=["opd_field_config"])


class Migration(migrations.Migration):

    dependencies = [
        ("settings_management", "0009_expand_opd_core_field_catalog"),
    ]

    operations = [
        migrations.RunPython(forwards_add_visit_date_core_field, migrations.RunPython.noop),
    ]
