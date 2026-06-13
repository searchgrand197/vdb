"""Canonical Create OPD / slip core field definitions (mirrored on the frontend)."""

OPD_CORE_FIELD_KEYS = (
    "phone",
    "uhid",
    "opd_no",
    "visit_date",
    "patient_name",
    "guardian",
    "age_sex",
    "address",
    "doctor",
    "department",
    "amount",
    "chief_complaint",
)

OPD_CORE_FIELD_CATALOG = {
    "phone": {
        "label": "Phone",
        "template_field_name": "Phone",
        "autofill_type": "phone",
    },
    "uhid": {
        "label": "UHID",
        "template_field_name": "UHID",
        "autofill_type": "uhid",
    },
    "opd_no": {
        "label": "OPD No",
        "template_field_name": "OPD No",
        "autofill_type": "token",
    },
    "visit_date": {
        "label": "Date",
        "template_field_name": "Date",
        "autofill_type": "visit_datetime",
    },
    "patient_name": {
        "label": "Patient Name",
        "template_field_name": "Patient",
        "autofill_type": "patient",
    },
    "guardian": {
        "label": "Guardian",
        "template_field_name": "Guardian",
        "autofill_type": "guardian",
    },
    "age_sex": {
        "label": "Age and Sex",
        "template_field_name": "Age and Sex",
        "autofill_type": "age_sex",
    },
    "address": {
        "label": "Address",
        "template_field_name": "Address",
        "autofill_type": "address",
    },
    "doctor": {
        "label": "Doctor",
        "template_field_name": "Doctor",
        "autofill_type": "doctor",
    },
    "department": {
        "label": "Department",
        "template_field_name": "Department",
        "autofill_type": "department",
    },
    "amount": {
        "label": "Amount",
        "template_field_name": "Amount",
        "autofill_type": "amount_mode",
    },
    "chief_complaint": {
        "label": "Chief Complaint",
        "template_field_name": "Chief Complaint",
        "autofill_type": "chief_complaint",
    },
}

TEMPLATE_NAME_TO_CORE_KEY = {
    row["template_field_name"]: key for key, row in OPD_CORE_FIELD_CATALOG.items()
}


def default_opd_field_config() -> dict:
    out = {
        key: {
            "createForm": True,
            "slip": True,
            "showLabel": True,
            "label": OPD_CORE_FIELD_CATALOG[key]["label"],
        }
        for key in OPD_CORE_FIELD_KEYS
    }
    out["opd_no"]["createForm"] = False
    out["visit_date"]["createForm"] = False
    return out


def normalize_opd_field_config(raw, hidden_fields=None) -> dict:
    hidden = set(hidden_fields or [])
    if isinstance(raw, dict) and raw:
        out = default_opd_field_config()
        for key in OPD_CORE_FIELD_KEYS:
            row = raw.get(key)
            if not isinstance(row, dict):
                continue
            out[key] = {
                "createForm": bool(row.get("createForm", True)),
                "slip": bool(row.get("slip", True)),
                "showLabel": bool(row.get("showLabel", True)),
                "label": str(row.get("label") or OPD_CORE_FIELD_CATALOG[key]["label"]).strip()
                or OPD_CORE_FIELD_CATALOG[key]["label"],
            }
        legacy_phone = raw.get("phone")
        if not isinstance(raw.get("uhid"), dict) and isinstance(legacy_phone, dict):
            out["uhid"] = {
                **out["uhid"],
                "createForm": bool(legacy_phone.get("createForm", True)),
                "slip": bool(legacy_phone.get("slip", True)),
                "showLabel": bool(legacy_phone.get("showLabel", True)),
            }
        legacy_age = raw.get("age")
        legacy_gender = raw.get("gender")
        if not isinstance(raw.get("age_sex"), dict) and (legacy_age or legacy_gender):
            out["age_sex"] = {
                **out["age_sex"],
                "createForm": bool((legacy_age or {}).get("createForm", True))
                and bool((legacy_gender or {}).get("createForm", True)),
                "slip": bool((legacy_age or {}).get("slip", True))
                or bool((legacy_gender or {}).get("slip", True)),
                "showLabel": bool((legacy_age or {}).get("showLabel", True))
                and bool((legacy_gender or {}).get("showLabel", True)),
            }
        if "age" in hidden or "gender" in hidden:
            out["age_sex"]["createForm"] = False
        return out

    out = default_opd_field_config()
    for key in OPD_CORE_FIELD_KEYS:
        if key in hidden:
            out[key]["createForm"] = False
    if "age" in hidden or "gender" in hidden:
        out["age_sex"]["createForm"] = False
    return out
