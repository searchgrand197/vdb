"""
Same-origin connectivity endpoints for the reception connection badge.

Avoids third-party CORS when the app is deployed on a custom domain.
"""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView


class ConnectivityPingView(APIView):
    """GET /api/v1/connectivity/ping/ — lightweight reachability check."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        response = Response(status=204)
        response["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return response
