from rest_framework import serializers

from apps.ipd.models import Scheme


class SchemeSerializer(serializers.ModelSerializer):
    hospital_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Scheme
        fields = [
            "id",
            "hospital_id",
            "name",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]


class SchemeCreateUpdateSerializer(serializers.ModelSerializer):
    hospital_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = Scheme
        fields = [
            "id",
            "hospital_id",
            "name",
            "description",
            "is_active",
        ]
        read_only_fields = ("id",)
