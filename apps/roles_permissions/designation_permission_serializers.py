from rest_framework import serializers

from apps.roles_permissions.models import DesignationModulePermission, DesignationPermissionProfile


class DesignationModulePermissionSerializer(serializers.ModelSerializer):
    module_code = serializers.CharField(source="module.code", read_only=True)
    module_name = serializers.CharField(source="module.name", read_only=True)

    class Meta:
        model = DesignationModulePermission
        fields = (
            "id",
            "module",
            "module_code",
            "module_name",
            "can_add",
            "can_edit",
            "can_delete",
            "can_view",
            "can_print",
            "can_download",
            "is_active",
        )
        read_only_fields = ("id", "module_code", "module_name")


class DesignationModulePermissionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DesignationModulePermission
        fields = (
            "module",
            "can_add",
            "can_edit",
            "can_delete",
            "can_view",
            "can_print",
            "can_download",
            "is_active",
        )


class DesignationPermissionProfileSerializer(serializers.ModelSerializer):
    designation_name = serializers.CharField(source="designation.name", read_only=True)
    designation_code = serializers.CharField(source="designation.code", read_only=True)
    hospital_id = serializers.UUIDField(source="designation.hospital_id", read_only=True)
    module_links = DesignationModulePermissionSerializer(many=True, read_only=True)

    class Meta:
        model = DesignationPermissionProfile
        fields = (
            "id",
            "designation",
            "designation_name",
            "designation_code",
            "hospital_id",
            "module_links",
        )


class DesignationPermissionProfileCreateSerializer(serializers.ModelSerializer):
    module_links = DesignationModulePermissionWriteSerializer(many=True, required=False, default=list)

    class Meta:
        model = DesignationPermissionProfile
        fields = ("id", "designation", "module_links")
        read_only_fields = ("id",)

    def validate_designation(self, value):
        if DesignationPermissionProfile.objects.filter(designation=value).exists():
            raise serializers.ValidationError("A permission profile already exists for this designation.")
        return value

    def create(self, validated_data):
        links_data = validated_data.pop("module_links", [])
        profile = DesignationPermissionProfile.objects.create(**validated_data)
        for row in links_data:
            DesignationModulePermission.objects.create(profile=profile, **row)
        return profile


class DesignationPermissionProfileUpdateSerializer(serializers.ModelSerializer):
    module_links = DesignationModulePermissionWriteSerializer(many=True, required=False)

    class Meta:
        model = DesignationPermissionProfile
        fields = ("id", "module_links")
        read_only_fields = ("id",)

    def update(self, instance, validated_data):
        links_data = validated_data.pop("module_links", serializers.empty)
        instance = super().update(instance, validated_data)
        if links_data is not serializers.empty:
            instance.module_links.all().delete()
            for row in links_data or []:
                DesignationModulePermission.objects.create(profile=instance, **row)
        return instance
