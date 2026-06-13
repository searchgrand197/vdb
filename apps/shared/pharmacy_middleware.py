"""Resolve active pharmacy branch from request headers."""

from __future__ import annotations

import uuid
import logging

from django.http import JsonResponse

logger = logging.getLogger(__name__)

_HEADER = "HTTP_X_PHARMACY_BRANCH"  # Django converts X-Pharmacy-Branch → this


def _authenticate_jwt_user(request):
    """Resolve JWT user for middleware (DRF auth runs later on API views)."""
    if getattr(request, "user", None) is not None and request.user.is_authenticated:
        return request.user
    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth_header.startswith("Bearer "):
        return None
    try:
        from rest_framework_simplejwt.authentication import JWTAuthentication

        result = JWTAuthentication().authenticate(request)
        if result:
            user, _token = result
            return user
    except Exception:
        logger.debug("PharmacyBranchMiddleware: JWT auth failed", exc_info=True)
    return None


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

        if pharmacy is not None:
            user = _authenticate_jwt_user(request)
            if user is not None and not getattr(user, "is_superuser", False):
                from apps.roles_permissions.effective_permissions import user_may_access_pharmacy

                if not user_may_access_pharmacy(user, pharmacy.id):
                    return JsonResponse(
                        {
                            "success": False,
                            "errors": {
                                "detail": [
                                    "Your account is not allowed to access this pharmacy branch."
                                ],
                            },
                        },
                        status=403,
                    )

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
