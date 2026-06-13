from rest_framework import permissions
from rest_framework.views import APIView

from apps.roles_permissions.models import Module
from apps.shared.response import success_response


class ModuleListView(APIView):
    """Active RBAC modules for permission matrix editors."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        rows = Module.objects.filter(is_active=True).order_by("code").values("id", "code", "name")
        return success_response(data=list(rows))
