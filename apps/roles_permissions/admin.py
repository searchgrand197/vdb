from django.contrib import admin

from .models import (
    DesignationModulePermission,
    DesignationPermissionProfile,
    GroupPermission,
    Module,
    Permission,
    PermissionGroup,
    Role,
    RoleFieldPermission,
    RolePermission,
    UserModulePermission,
    UserPermissionProfile,
)


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name", "is_active")
    search_fields = ("code", "name")


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "module", "action", "is_active")
    list_filter = ("module", "action", "is_active")
    search_fields = ("code", "description")


@admin.register(PermissionGroup)
class PermissionGroupAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "hospital", "is_active")
    search_fields = ("name",)


@admin.register(GroupPermission)
class GroupPermissionAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "permission", "is_active")
    list_filter = ("is_active",)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name", "hospital", "is_system", "is_active", "is_deleted")
    list_filter = ("hospital", "is_system", "is_active", "is_deleted")
    search_fields = ("code", "name")


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ("id", "role", "permission", "is_active")


@admin.register(DesignationPermissionProfile)
class DesignationPermissionProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "designation")


@admin.register(DesignationModulePermission)
class DesignationModulePermissionAdmin(admin.ModelAdmin):
    list_display = ("id", "profile", "module", "is_active")


@admin.register(UserPermissionProfile)
class UserPermissionProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user")


@admin.register(UserModulePermission)
class UserModulePermissionAdmin(admin.ModelAdmin):
    list_display = ("id", "profile", "module", "is_active")


@admin.register(RoleFieldPermission)
class RoleFieldPermissionAdmin(admin.ModelAdmin):
    list_display = ("id", "role", "module_code", "field_key", "can_create", "can_read", "can_update")
