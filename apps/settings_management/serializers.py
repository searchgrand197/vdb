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
    opd_fee_slots = serializers.ListField(required=False)
    current_opd_slot_fee = serializers.SerializerMethodField()
    current_opd_slot = serializers.SerializerMethodField()
    hospital_logo_url = serializers.SerializerMethodField()

    class Meta:
        model = ReceptionPortalSettings
        fields = [
            "id",
            "default_city",
            "default_state",
            "default_doctor_user",
            "invoice_prefix",
            "invoice_next_number",
            "hospital_name",
            "address",
            "pin_code",
            "phone",
            "email",
            "website",
            "hospital_logo",
            "hospital_logo_url",
            "print_with_background",
            "opd_fee_mode",
            "opd_fee_slots",
            "current_opd_slot_fee",
            "current_opd_slot",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_invoice_prefix(self, value):
        normalized = str(value or "").strip().upper()
        if not normalized:
            return "INV"
        if len(normalized) > 20:
            raise serializers.ValidationError("Invoice prefix cannot exceed 20 characters.")
        return normalized

    def validate_invoice_next_number(self, value):
        if value is None:
            return 1
        if int(value) < 1:
            raise serializers.ValidationError("Next invoice number must be at least 1.")
        return int(value)

    def get_current_opd_slot(self, obj):
        return obj.get_current_opd_slot()

    def get_current_opd_slot_fee(self, obj):
        return obj.get_current_opd_slot_fee()

    def get_hospital_logo_url(self, obj):
        if not obj.hospital_logo:
            return ""
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri(obj.hospital_logo.url)
        return obj.hospital_logo.url

    def validate_opd_fee_slots(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Slots must be a list.")
        cleaned = []
        for idx, row in enumerate(value):
            if not isinstance(row, dict):
                raise serializers.ValidationError(f"Slot #{idx + 1} must be an object.")
            start = str(row.get("start", "")).strip()
            end = str(row.get("end", "")).strip()
            amount = row.get("amount", "")
            if not start or not end:
                raise serializers.ValidationError(f"Slot #{idx + 1} needs start and end time.")
            if ":" not in start or ":" not in end:
                raise serializers.ValidationError(f"Slot #{idx + 1} time must be HH:MM.")
            try:
                amount_value = float(str(amount).strip())
            except Exception:
                raise serializers.ValidationError(f"Slot #{idx + 1} amount must be numeric.")
            if amount_value < 0:
                raise serializers.ValidationError(f"Slot #{idx + 1} amount cannot be negative.")
            # Preserve optional per-doctor scope and days fields (added by frontend).
            doctor_user_id = row.get("doctor_user_id")
            if doctor_user_id is not None:
                doctor_user_id = str(doctor_user_id).strip() or None
            days = row.get("days")
            if not isinstance(days, list):
                days = None
            entry = {
                "start": start[:5],
                "end": end[:5],
                "amount": round(amount_value, 2),
            }
            if doctor_user_id is not None:
                entry["doctor_user_id"] = doctor_user_id
            if days is not None:
                entry["days"] = days
            cleaned.append(entry)
        return cleaned
