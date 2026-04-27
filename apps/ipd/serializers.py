from rest_framework import serializers

from apps.ipd.models import IPDAdmission


class IPDAdmissionSerializer(serializers.ModelSerializer):
    patient_uhid = serializers.CharField(source="patient.uhid", read_only=True)
    patient_name = serializers.SerializerMethodField()
    assigned_doctor_email = serializers.EmailField(source="assigned_doctor.email", read_only=True)
    assigned_nurse_email = serializers.EmailField(source="assigned_nurse.email", read_only=True)
    hospital_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = IPDAdmission
        fields = [
            "id",
            "hospital_id",
            "patient",
            "patient_name",
            "patient_uhid",
            "ipd_no",
            "opd_visit",
            "admission_date",
            "expected_discharge_date",
            "assigned_doctor",
            "assigned_doctor_email",
            "assigned_nurse",
            "assigned_nurse_email",
            "ward_name",
            "department",
            "room_name",
            "bed_code",
            "admission_diagnosis",
            "admission_notes",
            "status",
            "discharged_at",
            "discharge_notes",
            "created_at",
            "updated_at",
        ]

    def get_patient_name(self, obj):
        if obj.patient:
            parts = [obj.patient.first_name, obj.patient.last_name]
            name = " ".join(filter(None, parts)).strip()
            return name or obj.patient.uhid
        return ""


class IPDAdmissionCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IPDAdmission
        fields = [
            "patient",
            "opd_visit",
            "admission_date",
            "expected_discharge_date",
            "assigned_doctor",
            "assigned_nurse",
            "ward_name",
            "department",
            "room_name",
            "bed_code",
            "admission_diagnosis",
            "admission_notes",
            "status",
            "discharge_notes",
            "discharged_at",
        ]

