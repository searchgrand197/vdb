from rest_framework import serializers

from apps.emergency.models import EmergencyCase


class EmergencyCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyCase
        fields = [
            "id",
            "hospital",
            "patient_name",
            "contact",
            "complaint",
            "triage",
            "status",
            "arrived_at",
            "attended_at",
            "admitted_at",
            "admitted_bed",
            "charge_amount",
            "charge_invoice_no",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "hospital", "created_at", "updated_at"]
