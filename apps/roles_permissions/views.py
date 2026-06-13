from rest_framework import permissions
from rest_framework.views import APIView

from apps.roles_permissions.effective_permissions import auth_session_payload_for_user
from apps.shared.response import success_response


class MyPermissionsView(APIView):
    """Returns allowed login portals for the authenticated user."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return success_response(data=auth_session_payload_for_user(request.user))
