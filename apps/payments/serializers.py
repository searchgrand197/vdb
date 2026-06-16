from rest_framework import serializers

from apps.billing.collection_attribution import resolve_attributed_doctor_display
from apps.billing.serializers import BillingInvoiceSerializer
from apps.patients.age_utils import dob_to_age_parts
from apps.payments.models import PaymentTransaction


class PaymentTransactionSerializer(serializers.ModelSerializer):
    hospital_id = serializers.UUIDField(read_only=True)
    invoice_no = serializers.CharField(source="invoice.invoice_no", read_only=True)
    patient_uhid = serializers.CharField(source="invoice.patient.uhid", read_only=True)
    patient_phone = serializers.CharField(source="invoice.patient.phone", read_only=True)
    patient_gender = serializers.CharField(source="invoice.patient.gender", read_only=True)
    patient_age = serializers.SerializerMethodField()
    patient_age_unit = serializers.SerializerMethodField()
    patient_guardian_name = serializers.SerializerMethodField()
    patient_guardian_relationship = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()
    collected_by_name = serializers.CharField(source="collected_by.full_name", read_only=True)
    attributed_doctor_name = serializers.SerializerMethodField()
    invoice_details = BillingInvoiceSerializer(source="invoice", read_only=True)

    class Meta:
        model = PaymentTransaction
        fields = [
            "id",
            "hospital_id",
            "invoice",
            "invoice_no",
            "invoice_details",
            "patient_name",
            "patient_uhid",
            "patient_phone",
            "patient_gender",
            "patient_age",
            "patient_age_unit",
            "patient_guardian_name",
            "patient_guardian_relationship",
            "payment_mode",
            "amount",
            "transaction_reference",
            "receipt_no",
            "slip_number",
            "status",
            "paid_at",
            "collected_by",
            "collected_by_name",
            "attribution_type",
            "attributed_doctor_user",
            "attributed_doctor_name",
            "voided",
            "created_at",
            "updated_at",
        ]

    def get_attributed_doctor_name(self, obj):
        return resolve_attributed_doctor_display(
            hospital_id=obj.hospital_id,
            attribution_type=obj.attribution_type,
            doctor_user=getattr(obj, "attributed_doctor_user", None),
        )

    def _invoice_patient(self, obj):
        return getattr(getattr(obj, "invoice", None), "patient", None)

    def get_patient_age(self, obj):
        patient = self._invoice_patient(obj)
        if not patient:
            return None
        value, _unit = dob_to_age_parts(patient.dob)
        return value

    def get_patient_age_unit(self, obj):
        patient = self._invoice_patient(obj)
        if not patient:
            return None
        _value, unit = dob_to_age_parts(patient.dob)
        return unit

    def get_patient_guardian_name(self, obj):
        patient = self._invoice_patient(obj)
        if not patient:
            return ""
        try:
            return (patient.guardian.name or "").strip()
        except Exception:
            return ""

    def get_patient_guardian_relationship(self, obj):
        patient = self._invoice_patient(obj)
        if not patient:
            return ""
        try:
            return (patient.guardian.relationship or "").strip()
        except Exception:
            return ""

    def get_patient_name(self, obj):
        patient = self._invoice_patient(obj)
        if not patient:
            return ""
        return f"{patient.first_name} {patient.last_name}".strip() or patient.uhid


class PaymentTransactionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentTransaction
        fields = ["invoice", "payment_mode", "amount", "transaction_reference", "receipt_no", "status", "paid_at"]
        extra_kwargs = {
            "status": {"required": False, "default": PaymentTransaction.Status.SUCCESS},
        }

