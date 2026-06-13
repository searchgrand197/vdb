from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.billing.models import BillingInvoice, CollectionAttribution, InvoiceItem
from apps.billing.collection_attribution import resolve_attributed_doctor_display

User = get_user_model()


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
    attributed_doctor_name = serializers.SerializerMethodField()

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
            "attribution_type",
            "attributed_doctor_user",
            "attributed_doctor_name",
            "cancelled_reason",
            "cancelled_at",
            "items",
            "created_at",
            "updated_at",
        ]

    def get_attributed_doctor_name(self, obj):
        return resolve_attributed_doctor_display(
            hospital_id=obj.hospital_id,
            attribution_type=obj.attribution_type,
            doctor_user=getattr(obj, "attributed_doctor_user", None),
        )


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
    attributed_doctor_user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )

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
            "attribution_type",
            "attributed_doctor_user",
        ]
        extra_kwargs = {
            "status": {"required": False, "default": BillingInvoice.Status.DRAFT},
            "attribution_type": {"required": False},
        }

    def validate(self, attrs):
        items = attrs.get("items") or []
        if not items:
            raise serializers.ValidationError({"items": ["At least one invoice item is required."]})
        attr_type = attrs.get("attribution_type") or CollectionAttribution.HOSPITAL_SELF
        doctor = attrs.get("attributed_doctor_user")
        if attr_type not in {CollectionAttribution.DOCTOR, CollectionAttribution.HOSPITAL_SELF}:
            raise serializers.ValidationError({"attribution_type": ["Must be doctor or hospital_self."]})
        if attr_type == CollectionAttribution.DOCTOR and not doctor and not attrs.get("opd_visit") and not attrs.get("ipd_admission"):
            raise serializers.ValidationError({"attributed_doctor_user": ["Select a doctor or choose Self (Hospital)."]})
        if attr_type == CollectionAttribution.HOSPITAL_SELF:
            attrs["attributed_doctor_user"] = None
        return attrs

