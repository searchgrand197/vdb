from __future__ import annotations

from apps.discharge.constants import (
    DISCHARGE_CHILD_CATALOG_FIELDS,
    DISCHARGE_TEXT_FIELDS,
    DISCHARGE_VITAL_FIELDS,
)
from apps.discharge.models import DischargeInvestigation, DischargeSummary, DischargeSurgery


def _normalize_catalog_value(value: str) -> str:
    return " ".join((value or "").strip().split())


def _catalog_key(value: str) -> str:
    return _normalize_catalog_value(value).casefold()


def _add_catalog_value(bucket: dict[str, str], value: str) -> None:
    normalized = _normalize_catalog_value(value)
    if not normalized:
        return
    key = _catalog_key(normalized)
    if key not in bucket:
        bucket[key] = normalized


def _sorted_catalog_values(bucket: dict[str, str]) -> list[str]:
    return sorted(bucket.values(), key=lambda v: v.casefold())


def build_discharge_field_catalog(hospital_id) -> dict:
    """Distinct discharge field values for hospital-wide autocomplete."""
    if not hospital_id:
        return {"fields": {}, "child_fields": {}, "vitals": {}}

    fields: dict[str, dict[str, str]] = {name: {} for name in DISCHARGE_TEXT_FIELDS}
    vitals: dict[str, dict[str, str]] = {name: {} for name in DISCHARGE_VITAL_FIELDS}
    child_fields: dict[str, dict[str, str]] = {name: {} for name in DISCHARGE_CHILD_CATALOG_FIELDS}

    summaries = (
        DischargeSummary.objects.filter(hospital_id=hospital_id, is_deleted=False)
        .order_by("-updated_at")
        .only(*DISCHARGE_TEXT_FIELDS, "vitals_at_discharge")
    )
    for summary in summaries:
        for field_name in DISCHARGE_TEXT_FIELDS:
            _add_catalog_value(fields[field_name], getattr(summary, field_name, ""))
        vitals_json = summary.vitals_at_discharge if isinstance(summary.vitals_at_discharge, dict) else {}
        for vital_name in DISCHARGE_VITAL_FIELDS:
            _add_catalog_value(vitals[vital_name], str(vitals_json.get(vital_name) or ""))

    surgery_rows = (
        DischargeSurgery.objects.filter(summary__hospital_id=hospital_id, summary__is_deleted=False)
        .order_by("-created_at")
        .values(
            "procedure_name",
            "surgeon_name",
            "assistant_name",
            "anaesthetist_name",
            "anaesthesia_type",
        )
    )
    for row in surgery_rows:
        for field_name in (
            "procedure_name",
            "surgeon_name",
            "assistant_name",
            "anaesthetist_name",
            "anaesthesia_type",
        ):
            _add_catalog_value(child_fields[field_name], row.get(field_name) or "")

    investigation_rows = (
        DischargeInvestigation.objects.filter(summary__hospital_id=hospital_id, summary__is_deleted=False)
        .order_by("-created_at")
        .values("test_name")
    )
    for row in investigation_rows:
        _add_catalog_value(child_fields["test_name"], row.get("test_name") or "")

    return {
        "fields": {name: _sorted_catalog_values(bucket) for name, bucket in fields.items()},
        "child_fields": {name: _sorted_catalog_values(bucket) for name, bucket in child_fields.items()},
        "vitals": {name: _sorted_catalog_values(bucket) for name, bucket in vitals.items()},
    }


def sanitize_discharge_template_payload(raw: dict | None) -> dict:
    """Keep only allowlisted discharge form keys for template storage."""
    from apps.discharge.constants import (
        DISCHARGE_CHOICE_FIELDS,
        DISCHARGE_TEMPLATE_EXCLUDE_FIELDS,
        DISCHARGE_TEXT_FIELDS,
        DISCHARGE_VITAL_FIELDS,
    )

    if not isinstance(raw, dict):
        return {}

    payload: dict = {}
    for field_name in DISCHARGE_TEXT_FIELDS + DISCHARGE_CHOICE_FIELDS:
        if field_name in raw and field_name not in DISCHARGE_TEMPLATE_EXCLUDE_FIELDS:
            payload[field_name] = raw.get(field_name) or ""

    if isinstance(raw.get("vitals_at_discharge"), dict):
        payload["vitals_at_discharge"] = {
            key: str(raw["vitals_at_discharge"].get(key) or "")
            for key in DISCHARGE_VITAL_FIELDS
        }

    for bool_field in ("autopsy_required", "patient_education_given"):
        if bool_field in raw:
            payload[bool_field] = bool(raw.get(bool_field))

    for list_field in ("investigation_rows", "surgery_rows"):
        rows = raw.get(list_field)
        if not isinstance(rows, list):
            continue
        cleaned_rows = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            cleaned_rows.append({k: v for k, v in row.items() if k != "id"})
        payload[list_field] = cleaned_rows

    return payload
