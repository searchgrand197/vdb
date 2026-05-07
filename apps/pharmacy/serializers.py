from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.pharmacy.calculations import normalize_gst_type
from apps.pharmacy.models import PharmacyInvoice, PharmacyInvoiceItem, PharmacyOutletSettings, PharmacySupplier
from apps.patients.serializers import PatientSerializer
from apps.doctors.serializers import DoctorProfileSerializer


class PharmacyOutletSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PharmacyOutletSettings
        fields = (
            "id",
            "business_name",
            "address",
            "mobile",
            "gst_number",
            "dl_number",
            "email",
            "website",
            "invoice_prefix",
            "invoice_next_number",
            "default_gst_percent",
            "default_sale_discount_percent",
            "b2b_enabled",
            "low_stock_threshold",
            "created_at",
            "updated_at",
        )

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


class PharmacyInvoiceItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.ReadOnlyField(source="medicine.name")
    batch_no = serializers.SerializerMethodField()
    expiry_date = serializers.SerializerMethodField()

    class Meta:
        model = PharmacyInvoiceItem
        fields = (
            "id",
            "invoice",
            "medicine",
            "medicine_name",
            "batch",
            "batch_no",
            "expiry_date",
            "snapshot_batch_no",
            "snapshot_expiry_date",
            "qty",
            "mrp",
            "rate",
            "cgst_rate",
            "sgst_rate",
            "amount",
        )
        extra_kwargs = {"batch": {"allow_null": True}}
        read_only_fields = ("snapshot_batch_no", "snapshot_expiry_date")

    def get_batch_no(self, obj):
        b = obj.batch
        if b is not None:
            return b.batch_no
        return obj.snapshot_batch_no or ""

    def get_expiry_date(self, obj):
        b = obj.batch
        if b is not None and b.expiry_date:
            return b.expiry_date
        return obj.snapshot_expiry_date

    def validate(self, attrs):
        request = self.context.get("request")
        allow_expired = False
        if request is not None:
            allow_expired = str(request.query_params.get("allow_expired", "")).lower() in ("1", "true", "yes")
        batch = attrs.get("batch") or getattr(self.instance, "batch", None)
        if (
            batch
            and batch.expiry_date
            and batch.expiry_date < timezone.now().date()
            and not allow_expired
        ):
            raise serializers.ValidationError({"batch": ["This batch is expired and cannot be sold."]})
        inv = attrs.get("invoice")
        if inv is None and getattr(self.instance, "invoice_id", None):
            inv = self.instance.invoice
        gst_on = True
        if inv is not None:
            if isinstance(inv, PharmacyInvoice):
                gst_on = inv.gst_enabled
            else:
                ge = PharmacyInvoice.objects.filter(pk=inv).values_list("gst_enabled", flat=True).first()
                gst_on = ge if ge is not None else True
        if not gst_on:
            attrs = {**attrs, "cgst_rate": Decimal("0"), "sgst_rate": Decimal("0")}
        return attrs


class PharmacyInvoiceSerializer(serializers.ModelSerializer):
    items = PharmacyInvoiceItemSerializer(many=True, read_only=True)
    patient_details = PatientSerializer(source="patient", read_only=True)
    doctor_details = DoctorProfileSerializer(source="referred_by", read_only=True)
    due_amount = serializers.SerializerMethodField()
    party_name = serializers.CharField(source="party.name", read_only=True, default="")
    party_details = serializers.SerializerMethodField()

    def validate(self, attrs: dict) -> dict:
        # Require either patient or party (but not both absent)
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        party = attrs.get("party", getattr(self.instance, "party", None))
        if patient is None and party is None:
            raise serializers.ValidationError({"detail": ["Either a patient or a B2B party must be provided."]})

        # Snapshot party name at save time
        if party is not None:
            attrs.setdefault("party_name_snapshot", getattr(party, "name", "") or "")

        gst_on = attrs.get("gst_enabled")
        if gst_on is None and self.instance is not None:
            gst_on = self.instance.gst_enabled
        if gst_on is False:
            attrs["cgst"] = Decimal("0")
            attrs["sgst"] = Decimal("0")
        grand_total = attrs.get("grand_total")
        paid_amount = attrs.get("paid_amount")
        payment_method = attrs.get("payment_method")
        if grand_total is None and self.instance is not None:
            grand_total = self.instance.grand_total
        if paid_amount is None and self.instance is not None:
            paid_amount = self.instance.paid_amount
        if payment_method is None and self.instance is not None:
            payment_method = self.instance.payment_method
        if paid_amount is not None and grand_total is not None:
            if paid_amount < 0:
                raise serializers.ValidationError({"paid_amount": ["Paid amount cannot be negative."]})
            if paid_amount > grand_total:
                raise serializers.ValidationError({"paid_amount": ["Paid amount cannot exceed grand total."]})
        if payment_method == "credit" and paid_amount is not None and paid_amount > 0:
            raise serializers.ValidationError({"paid_amount": ["Keep paid amount 0 for credit bills."]})
        return attrs

    def get_due_amount(self, obj):
        return str(max(Decimal("0"), (obj.grand_total or Decimal("0")) - (obj.paid_amount or Decimal("0"))))

    def get_party_details(self, obj):
        party = getattr(obj, "party", None)
        if party is None:
            return None
        return {
            "id": str(party.id),
            "name": party.name or "",
            "phone": party.phone or "",
            "gst_number": party.gst_number or "",
            "address": party.address or "",
        }

    class Meta:
        model = PharmacyInvoice
        fields = (
            "id",
            "patient",
            "patient_details",
            "party",
            "party_details",
            "party_name",
            "party_name_snapshot",
            "referred_by",
            "doctor_details",
            "invoice_no",
            "date",
            "status",
            "gst_enabled",
            "subtotal",
            "total_discount",
            "cgst",
            "sgst",
            "grand_total",
            "payment_method",
            "paid_amount",
            "due_amount",
            "ipd_admission",
            "remarks",
            "items",
            "created_at",
        )
        extra_kwargs = {
            # Generated in PharmacyInvoiceViewSet.perform_create if omitted.
            "invoice_no": {"required": False, "allow_blank": True},
            "patient": {"allow_null": True},
            "party": {"allow_null": True},
        }


class PharmacySupplierSerializer(serializers.ModelSerializer):
    pharmacy_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = PharmacySupplier
        fields = (
            "id",
            "pharmacy_id",
            "name",
            "phone",
            "gst_number",
            "address",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "pharmacy_id", "created_at", "updated_at")

    def create(self, validated_data):
        request = self.context.get("request")
        pharmacy = getattr(request, "pharmacy", None) if request is not None else None
        if pharmacy is None:
            raise serializers.ValidationError({"detail": ["Pharmacy branch context required."]})
        validated_data["pharmacy_id"] = pharmacy.id
        return super().create(validated_data)


class PurchaseChallanLineSerializer(serializers.Serializer):
    medicine = serializers.UUIDField()
    batch_no = serializers.CharField(max_length=80)
    expiry_date = serializers.DateField()
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3)
    # pack: quantity = strips/boxes; total_qty = quantity × conversion (tablets). base: quantity = tablets; conversion ignored.
    quantity_basis = serializers.ChoiceField(choices=["pack", "base"], default="pack")
    pack_type = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    conversion = serializers.DecimalField(max_digits=14, decimal_places=3, required=False, default=Decimal("1"))
    rate_type = serializers.ChoiceField(
        choices=["STRIP", "TABLET"],
        required=False,
        allow_null=True,
        default=None,
    )
    purchase_rate = serializers.DecimalField(max_digits=14, decimal_places=2)
    mrp = serializers.DecimalField(max_digits=14, decimal_places=2)
    sale_rate = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    gst_type = serializers.CharField(required=False, default="exclusive")
    gst_percent = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True)
    discount = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, default=Decimal("0"))
    skip_gst = serializers.BooleanField(required=False, default=False)
    no_gst = serializers.BooleanField(required=False, default=False)

    def validate_gst_percent(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("GST % cannot be negative.")
        return value

    def validate(self, attrs):
        attrs["gst_type"] = normalize_gst_type(attrs.get("gst_type"))
        if attrs.get("skip_gst") or attrs.get("no_gst"):
            attrs["no_gst"] = True
        return attrs


class PurchaseChallanSerializer(serializers.Serializer):
    supplier_id = serializers.UUIDField(required=False, allow_null=True)
    invoice_no = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    purchase_date = serializers.DateField(required=False)
    payment_type = serializers.ChoiceField(choices=["cash", "credit"], required=False, default="cash")
    gst_enabled = serializers.BooleanField(required=False, default=True)
    lines = PurchaseChallanLineSerializer(many=True)

    def validate(self, attrs):
        if not attrs.get("purchase_date"):
            attrs["purchase_date"] = timezone.now().date()
        attrs.setdefault("payment_type", "cash")
        attrs.setdefault("invoice_no", "")
        sid = attrs.get("supplier_id")
        if sid is not None:
            request = self.context["request"]
            pharmacy = getattr(request, "pharmacy", None)
            pid = getattr(pharmacy, "id", None)
            if not pid:
                raise serializers.ValidationError({"detail": ["Pharmacy branch context required."]})
            if not PharmacySupplier.objects.filter(pk=sid, pharmacy_id=pid, is_active=True).exists():
                raise serializers.ValidationError({"supplier_id": ["Invalid supplier for selected pharmacy branch."]})
        return attrs

    def validate_lines(self, lines):
        if not lines:
            raise serializers.ValidationError("At least one line is required.")
        return lines
