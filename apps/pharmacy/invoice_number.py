"""Sequential pharmacy invoice numbers with configurable prefix/seed."""

from __future__ import annotations

import re
from datetime import datetime

from django.db import transaction

from apps.pharmacy.models import PharmacyInvoice, PharmacyOutletSettings


def _invoice_seq_from_number(inv_no: str, prefix: str, legacy_prefix_upper: str) -> int | None:
    """Extract trailing sequence from invoice_no (new or legacy year-in-middle format)."""
    s = str(inv_no or "").strip()
    if not s:
        return None
    new_re = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)
    m = new_re.match(s)
    if m:
        return int(m.group(1))
    legacy_re = re.compile(rf"^{re.escape(legacy_prefix_upper)}-(\d{{4}})-(\d+)$", re.IGNORECASE)
    m = legacy_re.match(s)
    if m:
        return int(m.group(2))
    return None


def next_pharmacy_invoice_number(
    pharmacy_id,
    year: int | None = None,
    reserve: bool = False,
    channel: str = "b2c",
) -> str:
    """
    Build invoice number as prefix + sequence (e.g. A/111, b-333).
    Legacy invoices INV-2026-42 still count toward the sequence for the same prefix token.
    """
    _ = year or datetime.now().year  # kept for API compatibility; no longer embedded in number
    with transaction.atomic():
        settings_qs = PharmacyOutletSettings.objects
        if reserve:
            settings_qs = settings_qs.select_for_update()
        settings_obj, _ = settings_qs.get_or_create(
            pharmacy_id=pharmacy_id,
            defaults={"business_name": ""},
        )
        ch = "b2b" if str(channel or "").lower() == "b2b" else "b2c"
        prefix_attr = f"{ch}_invoice_prefix"
        next_attr = f"{ch}_invoice_next_number"
        prefix = (getattr(settings_obj, prefix_attr, None) or "INV").strip() or "INV"
        legacy_prefix_upper = prefix.upper()
        max_seq = max(int(getattr(settings_obj, next_attr, 1) or 1) - 1, 0)
        qs = PharmacyInvoice.objects.filter(pharmacy_id=pharmacy_id, voided=False).values_list("invoice_no", flat=True)
        for inv_no in qs:
            seq = _invoice_seq_from_number(inv_no, prefix, legacy_prefix_upper)
            if seq is not None:
                max_seq = max(max_seq, seq)
        next_seq = max_seq + 1
        if reserve:
            setattr(settings_obj, next_attr, next_seq + 1)
            settings_obj.save(update_fields=[next_attr])
        return f"{prefix}{next_seq}"
