from __future__ import annotations

from rest_framework import serializers

from apps.inventory.models import Medicine, MedicineBatch, MedicineCategory, MedicineReorderRule, StockLedger, Unit


class UnitSerializer(serializers.ModelSerializer):
    hospital_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Unit
        fields = ["id", "hospital_id", "code", "name", "is_active", "created_at", "updated_at"]


class UnitCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ["code", "name", "is_active"]


class MedicineSerializer(serializers.ModelSerializer):
    hospital_id = serializers.UUIDField(read_only=True)
    unit_name = serializers.CharField(source="unit.name", read_only=True)

    class Meta:
        model = Medicine
        fields = [
            "id",
            "hospital_id",
            "sku",
            "name",
            "company_name",
            "form",
            "composition",
            "strength",
            "unit",
            "unit_name",
            "hsn_code",
            "pack_info",
            "default_mrp",
            "unit_conversions",
            "gst_percent",
            "is_active",
            "created_at",
            "updated_at",
        ]


class MedicineCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicine
        fields = [
            "id",
            "sku",
            "name",
            "company_name",
            "form",
            "composition",
            "strength",
            "unit",
            "hsn_code",
            "pack_info",
            "default_mrp",
            "unit_conversions",
            "gst_percent",
            "is_active",
        ]
        extra_kwargs = {
            # Server assigns default TAB unit per hospital when omitted (pharmacy quick-create).
            "unit": {"required": False, "allow_null": True},
        }
        read_only_fields = ["id"]


class MedicineCategorySerializer(serializers.ModelSerializer):
    hospital_id = serializers.UUIDField(read_only=True)
    parent_name = serializers.CharField(source="parent.name", read_only=True)

    class Meta:
        model = MedicineCategory
        fields = [
            "id",
            "hospital_id",
            "name",
            "parent",
            "parent_name",
            "is_active",
            "rule_type",
            "allow_loose_sale",
            "base_unit_label",
            "retail_pack_label",
            "outer_pack_label",
            "created_at",
            "updated_at",
        ]


class MedicineCategoryCreateUpdateSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        parent = attrs.get("parent")
        if not parent:
            return attrs
        request = self.context.get("request")
        if request and parent.hospital_id != request.user.hospital_id:
            raise serializers.ValidationError({"parent": "Parent category must belong to your hospital."})
        if self.instance and str(parent.id) == str(self.instance.id):
            raise serializers.ValidationError({"parent": "A category cannot be its own parent."})
        return attrs

    class Meta:
        model = MedicineCategory
        fields = [
            "name",
            "parent",
            "is_active",
            "rule_type",
            "allow_loose_sale",
            "base_unit_label",
            "retail_pack_label",
            "outer_pack_label",
        ]


class MedicineBatchSerializer(serializers.ModelSerializer):
    hospital_id = serializers.UUIDField(read_only=True)
    medicine_name = serializers.CharField(source="medicine.name", read_only=True)
    quantity = serializers.SerializerMethodField()

    class Meta:
        model = MedicineBatch
        fields = [
            "id",
            "hospital_id",
            "medicine",
            "medicine_name",
            "batch_no",
            "expiry_date",
            "mfg_date",
            "unit_cost",
            "mrp",
            "sale_rate",
            "quantity",
            "created_at",
            "updated_at",
        ]

    def get_quantity(self, obj: MedicineBatch) -> float:
        from apps.inventory.services.stock_service import get_batch_available_qty

        return float(get_batch_available_qty(obj))


class MedicineBatchCreateUpdateSerializer(serializers.ModelSerializer):
    """Create/update: include id on response so clients can chain stock-ledgers and other calls."""

    class Meta:
        model = MedicineBatch
        fields = ["id", "medicine", "batch_no", "expiry_date", "mfg_date", "unit_cost", "mrp", "sale_rate"]
        read_only_fields = ["id"]


class MedicineBatchRatesUpdateSerializer(serializers.ModelSerializer):
    """ERP: only sale pricing may be edited from the desk; cost/expiry/batch stay system-controlled."""

    class Meta:
        model = MedicineBatch
        fields = ["mrp", "sale_rate"]



class StockLedgerSerializer(serializers.ModelSerializer):
    hospital_id = serializers.UUIDField(read_only=True)
    medicine_name = serializers.CharField(source="medicine.name", read_only=True)
    batch_no = serializers.CharField(source="batch.batch_no", read_only=True)

    class Meta:
        model = StockLedger
        fields = [
            "id",
            "hospital_id",
            "medicine",
            "medicine_name",
            "batch",
            "batch_no",
            "qty_change",
            "reason",
            "reference_type",
            "reference_id",
            "created_by",
            "created_at",
        ]


class StockLedgerCreateSerializer(serializers.Serializer):
    medicine = serializers.UUIDField()
    batch = serializers.UUIDField()
    reason = serializers.ChoiceField(choices=[c[0] for c in StockLedger.Reason.choices])
    qty_change = serializers.DecimalField(max_digits=12, decimal_places=3)
    reference_type = serializers.CharField(required=False, allow_blank=True, default="")
    reference_id = serializers.CharField(required=False, allow_blank=True, default="")
    allow_negative_stock = serializers.BooleanField(required=False, default=False)

