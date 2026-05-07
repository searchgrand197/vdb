from rest_framework import serializers

from apps.ipd.models import IPDAdmission
from apps.ipd.services import resolve_ipd_doctor_name


class IPDAdmissionSerializer(serializers.ModelSerializer):
    patient_uhid = serializers.CharField(source="patient.uhid", read_only=True)
    patient_name = serializers.SerializerMethodField()
    assigned_doctor_email = serializers.EmailField(source="assigned_doctor.email", read_only=True)
    assigned_doctor_name = serializers.SerializerMethodField()
    assigned_nurse_email = serializers.EmailField(source="assigned_nurse.email", read_only=True)
    guardian_name = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    mobile_number = serializers.SerializerMethodField()
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
            "assigned_doctor_name",
            "assigned_doctor_email",
            "assigned_nurse",
            "assigned_nurse_email",
            "guardian_name",
            "address",
            "mobile_number",
            "ward_name",
            "department",
            "room_name",
            "bed_code",
            "admission_diagnosis",
            "admission_notes",
            "status",
            "discharged_at",
            "discharge_notes",
            "room_rent_override",
            "room_rent_daily_charge_override",
            "created_at",
            "updated_at",
        ]

    def get_patient_name(self, obj):
        if obj.patient:
            parts = [obj.patient.first_name, obj.patient.last_name]
            name = " ".join(filter(None, parts)).strip()
            return name or obj.patient.uhid
        return ""

    def get_assigned_doctor_name(self, obj):
        return resolve_ipd_doctor_name(
            assigned_doctor=obj.assigned_doctor,
            hospital_id=getattr(obj, "hospital_id", None),
        )

    def get_guardian_name(self, obj):
        patient = getattr(obj, "patient", None)
        guardian = getattr(patient, "guardian", None) if patient is not None else None
        return (getattr(guardian, "name", "") or "").strip()

    def get_mobile_number(self, obj):
        patient = getattr(obj, "patient", None)
        return (getattr(patient, "phone", "") or "").strip()

    def get_address(self, obj):
        patient = getattr(obj, "patient", None)
        addr = getattr(patient, "address", None) if patient is not None else None
        if addr is None:
            return ""
        parts = [
            getattr(addr, "line1", "") or "",
            getattr(addr, "line2", "") or "",
            getattr(addr, "city", "") or "",
            getattr(addr, "state", "") or "",
            getattr(addr, "postal_code", "") or "",
        ]
        return ", ".join([p.strip() for p in parts if str(p).strip()])


class IPDAdmissionCreateUpdateSerializer(serializers.ModelSerializer):
    """Write serializer; `id` and `ipd_no` are read-only so create/update responses include them (e.g. for IPD slip = ledger ID)."""

    class Meta:
        model = IPDAdmission
        fields = [
            "id",
            "ipd_no",
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
        read_only_fields = ("id", "ipd_no")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if getattr(self, "instance", None):
            return attrs

        patient = attrs.get("patient")
        if not patient:
            return attrs

        hospital_id = getattr(patient, "hospital_id", None) or getattr(attrs.get("opd_visit"), "hospital_id", None)
        request = self.context.get("request")
        if not hospital_id and request is not None:
            hospital_id = getattr(request.user, "hospital_id", None)

        active_exists = IPDAdmission.objects.filter(
            hospital_id=hospital_id,
            patient=patient,
            is_deleted=False,
        ).exclude(
            status__in=[IPDAdmission.Status.DISCHARGED, IPDAdmission.Status.CANCELLED]
        ).first()
        if active_exists:
            raise serializers.ValidationError({
                "patient": [
                    f"Patient already has an active IPD admission ({active_exists.ipd_no or active_exists.id}) in "
                    f"{active_exists.ward_name or 'ward'} / {active_exists.bed_code or 'bed'}."
                ]
            })

        return attrs

