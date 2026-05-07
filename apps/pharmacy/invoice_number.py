"""Sequential pharmacy invoice numbers with configurable prefix/seed."""

from __future__ import annotations

import re
from datetime import datetime

from django.db import transaction

from apps.pharmacy.models import PharmacyInvoice, PharmacyOutletSettings


def next_pharmacy_invoice_number(pharmacy_id, year: int | None = None, reserve: bool = False) -> str:
    y = year or datetime.now().year
    with transaction.atomic():
        settings_qs = PharmacyOutletSettings.objects
        if reserve:
            settings_qs = settings_qs.select_for_update()
        settings_obj, _ = settings_qs.get_or_create(
            pharmacy_id=pharmacy_id,
            defaults={"business_name": ""},
        )
        prefix_token = (settings_obj.invoice_prefix or "INV").strip().upper() or "INV"
        inv_prefix = f"{prefix_token}-{y}-"
        inv_re = re.compile(rf"^{re.escape(prefix_token)}-(\d{{4}})-(\d+)$", re.IGNORECASE)
        qs = PharmacyInvoice.objects.filter(
            pharmacy_id=pharmacy_id, invoice_no__istartswith=inv_prefix
        ).values_list("invoice_no", flat=True)
        max_seq = max(int(settings_obj.invoice_next_number or 1) - 1, 0)
        for inv_no in qs:
            m = inv_re.match(str(inv_no).strip())
            if m and int(m.group(1)) == y:
                max_seq = max(max_seq, int(m.group(2)))
        next_seq = max_seq + 1
        if reserve:
            settings_obj.invoice_next_number = next_seq + 1
            settings_obj.save(update_fields=["invoice_next_number"])
        return f"{inv_prefix}{next_seq}"
