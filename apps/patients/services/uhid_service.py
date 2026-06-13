from django.utils import timezone

from apps.patients.models import Patient, UHIDSequence
from apps.settings_management.document_number_service import render_document_number
from apps.settings_management.models import ReceptionPortalSettings
from apps.shared.models import Hospital


def resolve_uhid_prefix(hospital: Hospital) -> str:
    """Hospital ID prefix from reception settings (UHIDs, IPD numbers, OPD numbers)."""
    settings = getattr(hospital, "reception_portal_settings", None)
    if settings is None:
        settings = (
            ReceptionPortalSettings.objects.filter(hospital=hospital)
            .only("uhid_prefix")
            .first()
        )
    raw = getattr(settings, "uhid_prefix", None) if settings else None
    prefix = str(raw or "").strip().upper()
    if prefix:
        return prefix[:8]
    slug_prefix = (hospital.slug or "").upper()[:3]
    return slug_prefix or "DEF"


def format_yearly_sequence_id(kind: str, hospital: Hospital, year: int, seq: int) -> str:
    """Legacy helper — maps kind token to configurable document type."""
    kind_upper = str(kind or "").strip().upper()
    doc_type_map = {
        "OPD": "opd",
        "IPD": "ipd",
        "PSL": "payment_slip",
    }
    doc_type = doc_type_map.get(kind_upper, "opd")
    return render_document_number(hospital, doc_type, year, seq)


def generate_uhid(hospital: Hospital) -> str:
    """
    Generates a hospital-scoped UHID using the configured template.
    """

    now = timezone.now()
    year = now.year

    seq, _ = UHIDSequence.objects.select_for_update().get_or_create(hospital=hospital, year=year)
    seq.last_seq += 1
    seq.save(update_fields=["last_seq"])

    return render_document_number(hospital, "uhid", year, seq.last_seq)


def patient_scoped_by_hospital(patient: Patient, hospital: Hospital) -> bool:
    return patient.hospital_id == hospital.id
