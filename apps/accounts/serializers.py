from django.contrib.auth import password_validation
from django.contrib.auth.hashers import check_password
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.accounts.models import User


class UserProfileSerializer(serializers.ModelSerializer):
    hospital_id = serializers.UUIDField(read_only=True)
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "phone",
            "first_name",
            "last_name",
            "full_name",
            "hospital_id",
            "is_staff",
            "is_superuser",
        ]


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["phone", "first_name", "last_name"]


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user: User = self.context["request"].user

        old_password = attrs.get("old_password")
        if not check_password(old_password, user.password):
            raise serializers.ValidationError({"old_password": _("Old password is incorrect.")})

        new_password = attrs.get("new_password")
        confirm_password = attrs.get("confirm_password")

        if new_password != confirm_password:
            raise serializers.ValidationError({"confirm_password": _("Passwords do not match.")})

        password_validation.validate_password(new_password, user=user)
        return attrs


class PublicPasswordChangeSerializer(serializers.Serializer):
    """
    Change password using login identifier (email) + current password — no JWT required.
    """

    email = serializers.EmailField()
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        email = value.strip().lower()
        try:
            self._target_user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError(_("No account found for this email address."))
        if not self._target_user.is_active:
            raise serializers.ValidationError(_("This account is disabled."))
        return email

    def validate(self, attrs):
        user: User = getattr(self, "_target_user", None)
        if user is None:
            raise serializers.ValidationError({"email": _("Invalid email.")})

        if not check_password(attrs["current_password"], user.password):
            raise serializers.ValidationError({"current_password": _("Current password is incorrect.")})

        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": _("Passwords do not match.")})

        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError(
                {"new_password": _("New password must be different from your current password.")}
            )

        password_validation.validate_password(attrs["new_password"], user=user)
        return attrs

    def save(self, **kwargs):
        user: User = self._target_user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user

