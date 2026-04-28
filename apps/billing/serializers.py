from decimal import Decimal

from rest_framework import serializers

from apps.billing.models import BillingInvoice, InvoiceItem


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = [
            "id",
            "description",
            "category",
            "subcategory",
            "quantity",
            "unit_price",
            "line_total",
            "created_at",
            "updated_at",
        ]


class BillingInvoiceSerializer(serializers.ModelSerializer):
    hospital_id = serializers.UUIDField(read_only=True)
    patient_id = serializers.UUIDField(read_only=True)
    patient_uhid = serializers.CharField(source="patient.uhid", read_only=True)
    items = InvoiceItemSerializer(many=True, read_only=True)

    class Meta:
        model = BillingInvoice
        fields = [
            "id",
            "hospital_id",
            "invoice_no",
            "encounter_type",
            "patient_id",
            "patient_uhid",
            "opd_visit",
            "ipd_admission",
            "invoice_date",
            "status",
            "currency",
            "subtotal_amount",
            "discount_amount",
            "tax_rate",
            "tax_amount",
            "total_amount",
            "amount_paid",
            "cancelled_reason",
            "cancelled_at",
            "items",
            "created_at",
            "updated_at",
        ]


class BillingInvoiceItemInputSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=300)
    category = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    subcategory = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1.00"))
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    def validate(self, attrs):
        qty = attrs.get("quantity")
        unit_price = attrs.get("unit_price")
        if qty < 0:
            raise serializers.ValidationError({"quantity": ["Quantity cannot be negative."]})
        if unit_price < 0:
            raise serializers.ValidationError({"unit_price": ["Unit price cannot be negative."]})
        return attrs


class BillingInvoiceCreateSerializer(serializers.ModelSerializer):
    items = BillingInvoiceItemInputSerializer(many=True)

    class Meta:
        model = BillingInvoice
        fields = [
            "encounter_type",
            "patient",
            "opd_visit",
            "ipd_admission",
            "invoice_date",
            "status",
            "discount_amount",
            "tax_rate",
            "currency",
            "items",
        ]
        extra_kwargs = {
            "status": {"required": False, "default": BillingInvoice.Status.DRAFT},
        }

    def validate(self, attrs):
        items = attrs.get("items") or []
        if not items:
            raise serializers.ValidationError({"items": ["At least one invoice item is required."]})
        return attrs

