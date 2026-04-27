"""Sequential pharmacy invoice numbers: INV-{YYYY}-{n}."""

from __future__ import annotations

import re
from datetime import datetime

from apps.pharmacy.models import PharmacyInvoice

INV_RE = re.compile(r"^INV-(\d{4})-(\d+)$", re.IGNORECASE)


def next_pharmacy_invoice_number(pharmacy_id, year: int | None = None) -> str:
    y = year or datetime.now().year
    prefix = f"INV-{y}-"
    qs = PharmacyInvoice.objects.filter(pharmacy_id=pharmacy_id, invoice_no__istartswith=prefix).values_list(
        "invoice_no", flat=True
    )
    max_seq = 0
    for inv_no in qs:
        m = INV_RE.match(str(inv_no).strip())
        if m and int(m.group(1)) == y:
            max_seq = max(max_seq, int(m.group(2)))
    return f"{prefix}{max_seq + 1}"
