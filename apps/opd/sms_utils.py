"""
Twilio SMS helpers for OPD visit notifications.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

import environ
from django.conf import settings

from apps.opd.models import OPDVisit
from apps.opd.services import resolve_opd_doctor_name

logger = logging.getLogger(__name__)


def get_twilio_config() -> tuple[str, str, str]:
    """
    Load Twilio credentials (re-reads .env so a running server picks up .env edits
    without a full restart).
    """
    env = environ.Env()
    env_file = Path(settings.BASE_DIR) / ".env"
    if env_file.exists():
        env.read_env(str(env_file), overwrite=True)

    account_sid = env.str("TWILIO_ACCOUNT_SID", default="").strip()
    auth_token = env.str("TWILIO_AUTH_TOKEN", default="").strip()
    from_number = env.str("TWILIO_FROM_NUMBER", default="").strip()

    if not account_sid:
        account_sid = (getattr(settings, "TWILIO_ACCOUNT_SID", "") or "").strip()
    if not auth_token:
        auth_token = (getattr(settings, "TWILIO_AUTH_TOKEN", "") or "").strip()
    if not from_number:
        from_number = (getattr(settings, "TWILIO_FROM_NUMBER", "") or "").strip()

    return account_sid, auth_token, from_number


def format_phone_e164(phone: str | None) -> str | None:
    """
    Format a phone number for Twilio.
    Prepends +91 when no country code is present; leaves +... numbers unchanged.
    """
    if not phone or not str(phone).strip():
        return None

    raw = str(phone).strip()
    if raw.startswith("+"):
        return raw

    digits = re.sub(r"\D", "", raw)
    if not digits:
        return None

    if digits.startswith("91") and len(digits) >= 12:
        return f"+{digits}"

    if len(digits) >= 10:
        return f"+91{digits[-10:]}"

    return None


def resolve_patient_sms_phone(patient) -> str | None:
    """Patient mobile first, then guardian contact as fallback."""
    to_number = format_phone_e164(getattr(patient, "phone", None))
    if to_number:
        return to_number

    guardian = getattr(patient, "guardian", None)
    if guardian:
        return format_phone_e164(getattr(guardian, "phone", None))

    return None


def build_opd_scheduled_sms_body(*, patient_name: str, opd_no: str, doctor_name: str) -> str:
    return (
        f"Hello {patient_name},\n\n"
        "Your OPD appointment has been successfully scheduled.\n"
        f"OPD number: {opd_no}\n"
        f"Doctor: {doctor_name}\n\n"
        "Please arrive 10 minutes before your scheduled time.\n"
        "If you have any reports, kindly bring them along.\n"
        "Thank you,\n"
        "Mr. Aman Berwal\n"
        "(Manager)\n\n"
        "Vardaan Hospital"
    )


def send_opd_scheduled_sms(visit_or_id) -> str | None:
    """
    Send an OPD scheduling SMS via Twilio. Returns message SID on success, else None.
    Failures are logged and do not propagate (OPD creation must not be blocked).
    """
    account_sid, auth_token, from_number = get_twilio_config()

    if not account_sid or not auth_token or not from_number:
        logger.warning("Twilio not configured; skipping OPD SMS")
        return None

    try:
        if isinstance(visit_or_id, OPDVisit):
            visit = OPDVisit.objects.select_related(
                "patient", "patient__guardian", "doctor_user"
            ).get(pk=visit_or_id.pk)
        else:
            visit = OPDVisit.objects.select_related(
                "patient", "patient__guardian", "doctor_user"
            ).get(pk=visit_or_id)
    except OPDVisit.DoesNotExist:
        logger.warning("OPD visit %s not found for SMS", visit_or_id)
        return None

    patient = visit.patient
    to_number = resolve_patient_sms_phone(patient)
    if not to_number:
        logger.warning(
            "No valid phone for OPD SMS (visit=%s patient=%s)",
            visit.id,
            patient.id,
        )
        return None

    patient_name = f"{patient.first_name or ''} {patient.last_name or ''}".strip() or patient.uhid or "Patient"
    doctor_name = resolve_opd_doctor_name(
        doctor_user=visit.doctor_user,
        hospital_id=visit.hospital_id,
    ) or "Doctor"
    # Same number shown on the printed slip (daily queue / token), e.g. "8"
    opd_display = str(visit.queue_number) if visit.queue_number else (visit.opd_no or str(visit.id))
    body = build_opd_scheduled_sms_body(
        patient_name=patient_name,
        opd_no=opd_display,
        doctor_name=doctor_name,
    )

    sid = send_twilio_sms(to_number=to_number, body=body)
    if sid:
        logger.info("OPD SMS sent visit=%s to=%s sid=%s", visit.id, to_number, sid)
    else:
        logger.error("Failed OPD SMS visit=%s to=%s", visit.id, to_number)
    return sid


def send_twilio_sms(*, to_number: str, body: str) -> str | None:
    """Send a plain SMS via Twilio. Returns message SID on success."""
    account_sid, auth_token, from_number = get_twilio_config()
    if not account_sid or not auth_token or not from_number:
        logger.warning("Twilio not configured; skipping SMS")
        return None
    if not to_number or not body:
        return None
    try:
        from twilio.rest import Client

        client = Client(account_sid, auth_token)
        message = client.messages.create(from_=from_number, body=body, to=to_number)
        return message.sid
    except Exception as exc:
        if getattr(exc, "code", None) == 20003:
            logger.error(
                "Twilio authentication failed (error 20003). "
                "Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env."
            )
        logger.error("Twilio SMS failed to=%s: %s", to_number, exc)
        return None
