from django.urls import path

from apps.roles_permissions.field_permission_views import (
    FieldPermissionMatrixView,
    FieldPermissionRoleListView,
    FieldPermissionSchemaView,
)
from apps.roles_permissions.module_views import ModuleListView
from apps.roles_permissions.views import MyPermissionsView

urlpatterns = [
    path("auth/me/permissions/", MyPermissionsView.as_view(), name="me-permissions"),
    path("modules/", ModuleListView.as_view(), name="rbac-modules"),
    path("field-permissions/schema/", FieldPermissionSchemaView.as_view(), name="field-permissions-schema"),
    path("field-permissions/roles/", FieldPermissionRoleListView.as_view(), name="field-permissions-roles"),
    path(
        "field-permissions/roles/<int:role_id>/",
        FieldPermissionMatrixView.as_view(),
        name="field-permissions-matrix",
    ),
]
