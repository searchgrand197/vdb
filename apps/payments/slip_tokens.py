"""Signed tokens for public payment-slip access (no login)."""

from __future__ import annotations

from django.core import signing

_SALT = "hms.payment.slip"
_MAX_AGE_SECONDS = 90 * 24 * 3600  # 90 days


def make_payment_slip_token(payment_id) -> str:
    return signing.dumps({"payment_id": str(payment_id)}, salt=_SALT)


def load_payment_slip_token(token: str) -> dict:
    return signing.loads(token, salt=_SALT, max_age=_MAX_AGE_SECONDS)
