from rest_framework import permissions, serializers, viewsets

from apps.accounts.views import SuperuserOnly
from apps.roles_permissions.models import Module, Permission, PermissionGroup, Role


class ModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = ["id", "code", "name", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = [
            "id",
            "module",
            "action",
            "code",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PermissionGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = PermissionGroup
        fields = ["id", "hospital", "name", "code", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "hospital", "name", "code", "is_system", "is_active", "created_at", "updated_at", "is_deleted", "deleted_at"]
        read_only_fields = ["id", "created_at", "updated_at", "deleted_at"]


class ModuleAdminViewSet(viewsets.ModelViewSet):
    queryset = Module.objects.all().order_by("code")
    serializer_class = ModuleSerializer
    permission_classes = [permissions.IsAuthenticated, SuperuserOnly]


class PermissionAdminViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.select_related("module").all().order_by("code")
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated, SuperuserOnly]


class PermissionGroupAdminViewSet(viewsets.ModelViewSet):
    queryset = PermissionGroup.objects.select_related("hospital").all().order_by("name")
    serializer_class = PermissionGroupSerializer
    permission_classes = [permissions.IsAuthenticated, SuperuserOnly]


class RoleAdminViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.select_related("hospital").all().order_by("name")
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, SuperuserOnly]
