from rest_framework.permissions import BasePermission


class HasRequiredPermission(BasePermission):
    """
    Placeholder for future module-level RBAC.

    For now, authenticated users pass when a view sets ``required_permission``.
    """

    def has_permission(self, request, view) -> bool:
        return bool(getattr(request.user, "is_authenticated", False))
