from rest_framework import serializers
from django.contrib.auth import get_user_model

from apps.settings_management.models import LeaveApprover, ReceptionPortalSettings


class LeaveApproverSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)

    class Meta:
        model = LeaveApprover
        fields = [
            "id",
            "hospital",
            "hospital_name",
            "user",
            "user_email",
            "user_name",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_user_name(self, obj) -> str:
        u = obj.user
        full = f"{getattr(u, 'first_name', '')} {getattr(u, 'last_name', '')}".strip()
        return full or u.email


class ReceptionPortalSettingsSerializer(serializers.ModelSerializer):
    default_doctor_user = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ReceptionPortalSettings
        fields = [
            "id",
            "default_city",
            "default_state",
            "default_doctor_user",
            "hospital_name",
            "address",
            "pin_code",
            "phone",
            "email",
            "website",
            "print_with_background",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
