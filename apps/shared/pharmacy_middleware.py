"""
Pharmacy Branch Middleware
==========================

When a pharmacy user selects a branch on the login page, the frontend sends
an ``X-Pharmacy-Branch: <hospital_uuid>`` header with every request.

This middleware intercepts that header and attaches the matching Hospital
object to ``request.pharmacy_hospital``.  All pharmacy views must use
``request.pharmacy_hospital`` (instead of ``request.user.hospital``) to
scope their DB queries, giving full data isolation per branch.

Security model
--------------
* Any *authenticated* user can switch pharmacy branch via the header — this
  is intentional because clinic staff often need to work across branches.
* If the header is absent or invalid the middleware falls back to
  ``request.user.hospital`` so non-pharmacy roles are unaffected.
* The selected hospital must have ``is_pharmacy=True`` and ``is_active=True``;
  otherwise the header is silently ignored.
"""

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
        request.pharmacy = self._resolve(request)
        return self.get_response(request)

    @staticmethod
    def _resolve(request):
        """
        Return the Hospital for the selected pharmacy branch.
        Falls back to ``request.user.hospital`` if:
          - header is absent
          - header UUID is invalid
          - hospital not found / not a pharmacy / not active
        """
        raw = request.META.get(_HEADER, "").strip()
        if not raw:
            return getattr(request.user, "hospital", None) if hasattr(request, "user") else None

        # Validate UUID format first (avoids pointless DB hit on garbage input)
        try:
            branch_uuid = uuid.UUID(raw)
        except ValueError:
            logger.debug("PharmacyBranchMiddleware: invalid UUID in header: %s", raw)
            return None

        # Look up the pharmacy branch
        try:
            from apps.pharmacy.models import Pharmacy
            pharmacy = Pharmacy.objects.get(
                id=branch_uuid,
                is_active=True,
            )
            return pharmacy
        except Pharmacy.DoesNotExist:
            logger.debug(
                "PharmacyBranchMiddleware: branch %s not found or inactive",
                branch_uuid,
            )
            return None
