"""
JWT serializers: attach tenant (hospital) to tokens and login JSON for clients.
"""

from __future__ import annotations

from typing import Any

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class HospitalTenantTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds ``hospital_id`` / ``hospital_name`` to login body and JWT claims."""

    @classmethod
    def get_token(cls, user: Any):
        token = super().get_token(user)
        hid = user.hospital_id
        token["hospital_id"] = str(hid) if hid else None
        return token

    def validate(self, attrs: dict) -> dict:
        username_field = getattr(self, "username_field", "email")
        raw_identifier = attrs.get(username_field)
        if isinstance(raw_identifier, str):
            attrs[username_field] = raw_identifier.strip().lower()

        data = super().validate(attrs)
        user = self.user
        data["is_active"] = bool(user.is_active)
        data["is_staff"] = bool(user.is_staff)
        data["is_superuser"] = bool(user.is_superuser)
        hid = user.hospital_id
        data["hospital_id"] = str(hid) if hid else None
        if hid:
            # Avoid N+1 if hospital was selected
            hospital = getattr(user, "hospital", None)
            if hospital is None:
                from apps.shared.models import Hospital

                hospital = Hospital.objects.filter(pk=hid).first()
            data["hospital_name"] = hospital.name if hospital else None
        else:
            data["hospital_name"] = None
        return data

