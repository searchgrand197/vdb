"""Resolve active pharmacy branch from request headers."""

from __future__ import annotations

import uuid
import logging

logger = logging.getLogger(__name__)

_HEADER = "HTTP_X_PHARMACY_BRANCH"  # Django converts X-Pharmacy-Branch → this


class PharmacyBranchMiddleware:
    """
    Middleware that resolves the active pharmacy branch from the
    ``X-Pharmacy-Branch`` request header and exposes it as
    ``request.pharmacy_hospital``.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        pharmacy, reason = self._resolve(request)
        request.pharmacy = pharmacy
        request.pharmacy_resolution_error = reason
        return self.get_response(request)

    @staticmethod
    def _resolve(request):
        """Return `(pharmacy, reason)` where reason is None if resolved."""
        raw = request.META.get(_HEADER, "").strip()
        if not raw:
            return None, "missing_header"

        # Validate UUID format first (avoids pointless DB hit on garbage input)
        try:
            branch_uuid = uuid.UUID(raw)
        except ValueError:
            logger.debug("PharmacyBranchMiddleware: invalid UUID in header: %s", raw)
            return None, "invalid_header_uuid"

        # Look up the pharmacy branch
        try:
            from apps.pharmacy.models import Pharmacy
            pharmacy = Pharmacy.objects.get(
                id=branch_uuid,
                is_active=True,
            )
            return pharmacy, None
        except Pharmacy.DoesNotExist:
            logger.debug(
                "PharmacyBranchMiddleware: branch %s not found or inactive",
                branch_uuid,
            )
            return None, "branch_not_found_or_inactive"
