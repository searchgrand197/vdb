"""Doctor revenue report: OPD / IPD / payment-slip breakdown with daily series."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Prefetch

from apps.billing.collection_attribution import doctor_name_map
from apps.billing.models import CollectionAttribution, InvoiceItem
from apps.opd.models import OPDVisit
from apps.payments.models import PaymentQuickService, PaymentTransaction

SELF_KEY = "__self__"
UNCATEGORIZED = "Uncategorized"


def _decimal(value) -> Decimal:
    if value is None:
        return Decimal("0.00")
    return Decimal(str(value))


def _money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))


def _daterange(date_from: date | None, date_to: date | None) -> list[date]:
    if not date_from or not date_to or date_from > date_to:
        return []
    out: list[date] = []
    cur = date_from
    while cur <= date_to:
        out.append(cur)
        cur += timedelta(days=1)
    return out


def _bucket_key(attribution_type: str, doctor_user_id) -> str:
    if attribution_type == CollectionAttribution.DOCTOR and doctor_user_id:
        return str(doctor_user_id)
    return SELF_KEY


def _is_refund_payment(inv_no: str, amount: Decimal) -> bool:
    return "IPDREF" in str(inv_no or "").upper() or amount < Decimal("0")


def _new_bucket() -> dict[str, Any]:
    return {
        "opd_count": 0,
        "opd_total": Decimal("0.00"),
        "opd_by_date": defaultdict(lambda: Decimal("0.00")),
        "ipd_count": 0,
        "ipd_total": Decimal("0.00"),
        "ipd_by_date": defaultdict(lambda: Decimal("0.00")),
        "slip_payment_ids": set(),
        "slip_total": Decimal("0.00"),
        "slip_by_date": defaultdict(lambda: Decimal("0.00")),
        "slip_lines_by_category": defaultdict(list),
        "refund_count": 0,
        "refund_total": Decimal("0.00"),
        "refund_by_date": defaultdict(lambda: Decimal("0.00")),
    }


def _build_quick_service_catalog(hospital_id) -> dict[tuple[str, str], str]:
    catalog: dict[tuple[str, str], str] = {}
    for svc in PaymentQuickService.objects.filter(hospital_id=hospital_id, is_active=True):
        label = str(svc.label or "").strip().lower()
        price = _money(_decimal(svc.price))
        if label:
            catalog[(label, price)] = str(svc.category or "Custom").strip() or "Custom"
    return catalog


def _resolve_item_category(item: InvoiceItem, catalog: dict[tuple[str, str], str]) -> str:
    stored = str(item.category or "").strip()
    if stored:
        return stored
    label = str(item.description or "").strip().lower()
    price = _money(_decimal(item.unit_price))
    if label and (label, price) in catalog:
        return catalog[(label, price)]
    return UNCATEGORIZED


def _serialize_bucket(
    *,
    bucket_key: str,
    bucket: dict[str, Any],
    name_map: dict[str, str],
    date_from: date | None,
    date_to: date | None,
) -> dict[str, Any]:
    opd_total = bucket["opd_total"]
    ipd_total = bucket["ipd_total"]
    slip_total = bucket["slip_total"]
    refund_total = bucket["refund_total"]
    grand_total = opd_total + ipd_total + slip_total - refund_total

    payment_slips_by_category = []
    for cat in sorted(bucket["slip_lines_by_category"].keys(), key=str.lower):
        lines = bucket["slip_lines_by_category"][cat]
        cat_total = sum(_decimal(line["amount"]) for line in lines)
        payment_slips_by_category.append(
            {
                "category": cat,
                "line_count": len(lines),
                "total": _money(cat_total),
            }
        )

    daily = []
    interval_opd = Decimal("0.00")
    interval_ipd = Decimal("0.00")
    interval_slips = Decimal("0.00")
    interval_refunds = Decimal("0.00")
    for day in _daterange(date_from, date_to):
        opd_day = bucket["opd_by_date"].get(day, Decimal("0.00"))
        ipd_day = bucket["ipd_by_date"].get(day, Decimal("0.00"))
        slips_day = bucket["slip_by_date"].get(day, Decimal("0.00"))
        refunds_day = bucket["refund_by_date"].get(day, Decimal("0.00"))
        day_total = opd_day + ipd_day + slips_day - refunds_day
        interval_opd += opd_day
        interval_ipd += ipd_day
        interval_slips += slips_day
        interval_refunds += refunds_day
        daily.append(
            {
                "date": day.isoformat(),
                "opd_total": _money(opd_day),
                "ipd_total": _money(ipd_day),
                "slips_total": _money(slips_day),
                "refunds_total": _money(refunds_day),
                "day_total": _money(day_total),
            }
        )

    doctor_name = "Self (Hospital)"
    doctor_user_id = None
    if bucket_key != SELF_KEY:
        doctor_user_id = bucket_key
        doctor_name = name_map.get(bucket_key, "Doctor")

    return {
        "doctor_user_id": doctor_user_id,
        "doctor_name": doctor_name,
        "summary": {
            "opd": {"count": bucket["opd_count"], "total": _money(opd_total)},
            "ipd": {"count": bucket["ipd_count"], "total": _money(ipd_total)},
            "payment_slips": {"count": len(bucket["slip_payment_ids"]), "total": _money(slip_total)},
            "refunds": {"count": bucket["refund_count"], "total": _money(refund_total)},
            "grand_total": _money(grand_total),
        },
        "payment_slips_by_category": payment_slips_by_category,
        "daily": daily,
        "interval_total": _money(grand_total),
    }


def build_doctor_revenue_report(
    *,
    hospital_id,
    date_from: date | None,
    date_to: date | None,
    doctor_filter: str = "",
    slip_category: str = "",
) -> dict[str, Any]:
    catalog = _build_quick_service_catalog(hospital_id)
    category_filter = str(slip_category or "").strip()

    buckets: dict[str, dict[str, Any]] = defaultdict(_new_bucket)

    opd_qs = OPDVisit.objects.filter(hospital_id=hospital_id).exclude(status=OPDVisit.Status.CANCELLED)
    if date_from:
        opd_qs = opd_qs.filter(visit_date__gte=date_from)
    if date_to:
        opd_qs = opd_qs.filter(visit_date__lte=date_to)

    for visit in opd_qs.only("doctor_user_id", "amount", "visit_date", "opd_no"):
        key = str(visit.doctor_user_id) if visit.doctor_user_id else SELF_KEY
        if doctor_filter and key != doctor_filter and key != SELF_KEY:
            continue
        if doctor_filter and key == SELF_KEY and doctor_filter != SELF_KEY:
            continue
        bucket = buckets[key]
        amt = _decimal(visit.amount)
        bucket["opd_count"] += 1
        bucket["opd_total"] += amt
        if visit.visit_date:
            bucket["opd_by_date"][visit.visit_date] += amt

    item_prefetch = Prefetch(
        "invoice__items",
        queryset=InvoiceItem.objects.all().only(
            "id", "invoice_id", "description", "category", "quantity", "unit_price", "line_total"
        ),
    )
    pay_qs = (
        PaymentTransaction.objects.filter(
            hospital_id=hospital_id,
            status=PaymentTransaction.Status.SUCCESS,
            is_deleted=False,
        )
        .select_related("invoice")
        .prefetch_related(item_prefetch)
    )
    if date_from:
        pay_qs = pay_qs.filter(paid_at__date__gte=date_from)
    if date_to:
        pay_qs = pay_qs.filter(paid_at__date__lte=date_to)

    for payment in pay_qs:
        invoice = payment.invoice
        inv_no = str(invoice.invoice_no or "")
        key = _bucket_key(payment.attribution_type, payment.attributed_doctor_user_id)

        if doctor_filter:
            if doctor_filter == SELF_KEY:
                if key != SELF_KEY:
                    continue
            elif key != doctor_filter:
                continue

        paid_date = payment.paid_at.date() if payment.paid_at else None
        amount = _decimal(payment.amount)

        if _is_refund_payment(inv_no, amount):
            bucket = buckets[key]
            refund_amt = abs(amount)
            bucket["refund_count"] += 1
            bucket["refund_total"] += refund_amt
            if paid_date:
                bucket["refund_by_date"][paid_date] += refund_amt
            continue

        if invoice.ipd_admission_id:
            bucket = buckets[key]
            bucket["ipd_count"] += 1
            bucket["ipd_total"] += amount
            if paid_date:
                bucket["ipd_by_date"][paid_date] += amount
            continue

        if inv_no.startswith("IPDADV-"):
            continue

        bucket = buckets[key]
        items = list(invoice.items.all())
        if category_filter:
            matched_lines = []
            for item in items:
                cat = _resolve_item_category(item, catalog)
                if cat != category_filter:
                    continue
                line_amt = _decimal(item.line_total)
                matched_lines.append(
                    {
                        "slip_number": payment.slip_number or "",
                        "description": item.description or "",
                        "category": cat,
                        "qty": _money(_decimal(item.quantity)),
                        "rate": _money(_decimal(item.unit_price)),
                        "amount": _money(line_amt),
                        "paid_at": payment.paid_at.isoformat() if payment.paid_at else "",
                    }
                )
            if not matched_lines:
                continue
            line_sum = sum(_decimal(line["amount"]) for line in matched_lines)
            bucket["slip_payment_ids"].add(str(payment.id))
            bucket["slip_total"] += line_sum
            if paid_date:
                bucket["slip_by_date"][paid_date] += line_sum
            for line in matched_lines:
                bucket["slip_lines_by_category"][line["category"]].append(line)
        else:
            bucket["slip_payment_ids"].add(str(payment.id))
            bucket["slip_total"] += amount
            if paid_date:
                bucket["slip_by_date"][paid_date] += amount
            for item in items:
                cat = _resolve_item_category(item, catalog)
                line_amt = _decimal(item.line_total)
                bucket["slip_lines_by_category"][cat].append(
                    {
                        "slip_number": payment.slip_number or "",
                        "description": item.description or "",
                        "category": cat,
                        "qty": _money(_decimal(item.quantity)),
                        "rate": _money(_decimal(item.unit_price)),
                        "amount": _money(line_amt),
                        "paid_at": payment.paid_at.isoformat() if payment.paid_at else "",
                    }
                )

    doctor_ids = {k for k in buckets.keys() if k != SELF_KEY}
    name_map = doctor_name_map(hospital_id, doctor_ids)

    doctors_out = []
    self_out = None
    doctors_grand = Decimal("0.00")

    for key in sorted(buckets.keys(), key=lambda k: (k == SELF_KEY, name_map.get(k, "").lower() if k != SELF_KEY else "")):
        if key == SELF_KEY:
            if doctor_filter and doctor_filter != SELF_KEY:
                continue
            self_out = _serialize_bucket(
                bucket_key=key,
                bucket=buckets[key],
                name_map=name_map,
                date_from=date_from,
                date_to=date_to,
            )
        else:
            if doctor_filter and doctor_filter != key:
                continue
            row = _serialize_bucket(
                bucket_key=key,
                bucket=buckets[key],
                name_map=name_map,
                date_from=date_from,
                date_to=date_to,
            )
            doctors_out.append(row)
            doctors_grand += _decimal(row["interval_total"])

    self_grand = _decimal(self_out["interval_total"]) if self_out else Decimal("0.00")
    if doctor_filter and doctor_filter != SELF_KEY:
        grand_total = doctors_grand
    elif doctor_filter == SELF_KEY:
        grand_total = self_grand
    else:
        grand_total = doctors_grand + self_grand

    return {
        "date_from": date_from.isoformat() if date_from else None,
        "date_to": date_to.isoformat() if date_to else None,
        "slip_category": category_filter or None,
        "doctors": doctors_out,
        "hospital_self": self_out,
        "grand_total": _money(grand_total),
    }
