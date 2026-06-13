"""Age ↔ DOB helpers for reception (years / months / days)."""

from __future__ import annotations

from datetime import date, timedelta

AGE_UNIT_YEARS = "years"
AGE_UNIT_MONTHS = "months"
AGE_UNIT_DAYS = "days"

VALID_AGE_UNITS = {AGE_UNIT_YEARS, AGE_UNIT_MONTHS, AGE_UNIT_DAYS}


def _days_in_month(year: int, month: int) -> int:
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    return (next_month - date(year, month, 1)).days


def dob_to_age_parts(dob: date | None) -> tuple[int | None, str | None]:
    """Return (value, unit) best suited for display — days / months / years."""
    if not dob:
        return None, None
    today = date.today()
    if dob > today:
        return None, None

    delta_days = (today - dob).days
    if delta_days < 30:
        return delta_days, AGE_UNIT_DAYS

    total_months = (today.year - dob.year) * 12 + (today.month - dob.month)
    if today.day < dob.day:
        total_months -= 1
    if total_months < 24:
        return max(0, total_months), AGE_UNIT_MONTHS

    years = today.year - dob.year
    if (today.month, today.day) < (dob.month, dob.day):
        years -= 1
    return max(0, years), AGE_UNIT_YEARS


def dob_to_age_years(dob: date | None) -> int | None:
    if not dob:
        return None
    today = date.today()
    years = today.year - dob.year
    if (today.month, today.day) < (dob.month, dob.day):
        years -= 1
    return max(0, years)


def age_parts_to_dob(age, unit: str = AGE_UNIT_YEARS) -> date | None:
    if age is None:
        return None
    try:
        age_int = int(age)
    except (TypeError, ValueError):
        return None
    if age_int < 0:
        return None

    today = date.today()
    unit_norm = (unit or AGE_UNIT_YEARS).strip().lower()
    if unit_norm not in VALID_AGE_UNITS:
        unit_norm = AGE_UNIT_YEARS

    if unit_norm == AGE_UNIT_DAYS:
        return today - timedelta(days=age_int)

    if unit_norm == AGE_UNIT_MONTHS:
        month = today.month - age_int
        year = today.year
        while month <= 0:
            month += 12
            year -= 1
        day = min(today.day, _days_in_month(year, month))
        return date(year, month, day)

    try:
        return date(today.year - age_int, today.month, today.day)
    except ValueError:
        return date(today.year - age_int, today.month, 28)


def is_child_age(age, unit: str = AGE_UNIT_YEARS) -> bool:
    unit_norm = (unit or AGE_UNIT_YEARS).strip().lower()
    if unit_norm in (AGE_UNIT_DAYS, AGE_UNIT_MONTHS):
        return True
    if age is None:
        return False
    try:
        return int(age) < 18
    except (TypeError, ValueError):
        return False
