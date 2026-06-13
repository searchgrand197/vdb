from django.db import migrations

from apps.settings_management.opd_field_catalog import OPD_CORE_FIELD_CATALOG, default_opd_field_config


def _row_from_legacy(cfg, key, fallback):
    src = cfg.get(key) if isinstance(cfg, dict) else None
    if not isinstance(src, dict):
        return fallback
    return {
        "createForm": bool(src.get("createForm", fallback["createForm"])),
        "slip": bool(src.get("slip", fallback["slip"])),
        "showLabel": bool(src.get("showLabel", fallback["showLabel"])),
        "label": str(src.get("label") or fallback["label"]).strip() or fallback["label"],
    }


def forwards_expand_opd_core_fields(apps, schema_editor):
    ReceptionPortalSettings = apps.get_model("settings_management", "ReceptionPortalSettings")
    defaults = default_opd_field_config()
    for row in ReceptionPortalSettings.objects.all().iterator():
        cfg = row.opd_field_config if isinstance(row.opd_field_config, dict) else {}
        next_cfg = {key: dict(defaults[key]) for key in OPD_CORE_FIELD_CATALOG}

        next_cfg["phone"] = _row_from_legacy(cfg, "phone", next_cfg["phone"])
        next_cfg["phone"]["label"] = OPD_CORE_FIELD_CATALOG["phone"]["label"]

        next_cfg["uhid"] = _row_from_legacy(cfg, "uhid", next_cfg["uhid"])
        if cfg.get("phone") and not cfg.get("uhid"):
            next_cfg["uhid"]["createForm"] = bool(cfg["phone"].get("createForm", True))
            next_cfg["uhid"]["slip"] = bool(cfg["phone"].get("slip", True))
            next_cfg["uhid"]["showLabel"] = bool(cfg["phone"].get("showLabel", True))

        next_cfg["opd_no"] = _row_from_legacy(cfg, "opd_no", next_cfg["opd_no"])

        for key in ("patient_name", "guardian", "address", "doctor", "department", "amount", "chief_complaint"):
            next_cfg[key] = _row_from_legacy(cfg, key, next_cfg[key])

        age_row = cfg.get("age") if isinstance(cfg.get("age"), dict) else {}
        gender_row = cfg.get("gender") if isinstance(cfg.get("gender"), dict) else {}
        next_cfg["age_sex"] = _row_from_legacy(cfg, "age_sex", next_cfg["age_sex"])
        if age_row or gender_row:
            next_cfg["age_sex"]["createForm"] = bool(age_row.get("createForm", True)) and bool(
                gender_row.get("createForm", True)
            )
            next_cfg["age_sex"]["slip"] = bool(age_row.get("slip", True)) or bool(gender_row.get("slip", True))
            next_cfg["age_sex"]["showLabel"] = bool(age_row.get("showLabel", True)) and bool(
                gender_row.get("showLabel", True)
            )

        row.opd_field_config = next_cfg
        row.save(update_fields=["opd_field_config"])


class Migration(migrations.Migration):

    dependencies = [
        ("settings_management", "0008_receptionportalsettings_opd_field_config"),
    ]

    operations = [
        migrations.RunPython(forwards_expand_opd_core_fields, migrations.RunPython.noop),
    ]
