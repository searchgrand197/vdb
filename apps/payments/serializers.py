from rest_framework import serializers

from apps.billing.serializers import BillingInvoiceSerializer
from apps.payments.models import PaymentTransaction


class PaymentTransactionSerializer(serializers.ModelSerializer):
    hospital_id = serializers.UUIDField(read_only=True)
    invoice_no = serializers.CharField(source="invoice.invoice_no", read_only=True)
    patient_uhid = serializers.CharField(source="invoice.patient.uhid", read_only=True)
    patient_name = serializers.SerializerMethodField()
    collected_by_name = serializers.CharField(source="collected_by.full_name", read_only=True)
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
            "payment_mode",
            "amount",
            "transaction_reference",
            "receipt_no",
            "slip_number",
            "status",
            "paid_at",
            "collected_by",
            "collected_by_name",
            "created_at",
            "updated_at",
        ]

    def get_patient_name(self, obj):
        patient = getattr(getattr(obj, "invoice", None), "patient", None)
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

