from __future__ import annotations

from rest_framework import serializers

from apps.inventory.models import Medicine, MedicineBatch, MedicineCategory, MedicineReorderRule, StockLedger, Unit


class UnitSerializer(serializers.ModelSerializer):
    pharmacy_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Unit
        fields = ["id", "pharmacy_id", "code", "name", "is_active", "created_at", "updated_at"]


class UnitCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ["code", "name", "is_active"]


class MedicineSerializer(serializers.ModelSerializer):
    pharmacy_id = serializers.UUIDField(read_only=True)
    unit_name = serializers.CharField(source="unit.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Medicine
        fields = [
            "id",
            "pharmacy_id",
            "sku",
            "name",
            "company_name",
            "form",
            "category",
            "category_name",
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
    def validate(self, attrs):
        request = self.context.get("request")
        request_pharmacy = getattr(request, "pharmacy", None) if request is not None else None
        request_pharmacy_id = getattr(request_pharmacy, "id", None)

        raw_sku = attrs.get("sku", getattr(self.instance, "sku", ""))
        sku = (raw_sku or "").strip()
        if not sku:
            raise serializers.ValidationError({"sku": "SKU is required."})
        attrs["sku"] = sku

        raw_name = attrs.get("name", getattr(self.instance, "name", ""))
        name = (raw_name or "").strip()
        if not name:
            raise serializers.ValidationError({"name": "Medicine name is required."})
        attrs["name"] = name

        # Enforce SKU uniqueness per pharmacy branch. We can't rely on DRF's
        # UniqueTogetherValidator because pharmacy_id is set in perform_create.
        if request_pharmacy_id:
            existing = Medicine.objects.filter(pharmacy_id=request_pharmacy_id, sku__iexact=sku)
            if self.instance:
                existing = existing.exclude(id=self.instance.id)
            if existing.exists():
                raise serializers.ValidationError({"sku": "A medicine with this SKU already exists."})
            category = attrs.get("category", getattr(self.instance, "category", None))
            if category is not None and str(getattr(category, "pharmacy_id", "")) != str(request_pharmacy_id):
                raise serializers.ValidationError({"category": "Category must belong to selected pharmacy branch."})

        return attrs

    class Meta:
        model = Medicine
        fields = [
            "id",
            "sku",
            "name",
            "company_name",
            "form",
            "category",
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
    pharmacy_id = serializers.UUIDField(read_only=True)
    parent_name = serializers.CharField(source="parent.name", read_only=True)

    class Meta:
        model = MedicineCategory
        fields = [
            "id",
            "pharmacy_id",
            "name",
            "color",
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
        request = self.context.get("request")
        request_pharmacy = getattr(request, "pharmacy", None) if request is not None else None
        request_pharmacy_id = getattr(request_pharmacy, "id", None)
        parent = attrs.get("parent", getattr(self.instance, "parent", None))
        raw_name = attrs.get("name", getattr(self.instance, "name", ""))
        name = (raw_name or "").strip()
        if not name:
            raise serializers.ValidationError({"name": "Category name is required."})
        attrs["name"] = name
        if "color" in attrs:
            color = (attrs.get("color") or "").strip()
            if color and (not color.startswith("#") or len(color) != 7):
                raise serializers.ValidationError({"color": "Color must be in #RRGGBB format."})
            if color:
                try:
                    int(color[1:], 16)
                except ValueError as exc:
                    raise serializers.ValidationError({"color": "Color must be in #RRGGBB format."}) from exc
            attrs["color"] = color.upper()

        if parent is not None:
            if request_pharmacy_id and str(parent.pharmacy_id) != str(request_pharmacy_id):
                raise serializers.ValidationError({"parent": "Parent category must belong to selected pharmacy branch."})
            if self.instance and str(parent.id) == str(self.instance.id):
                raise serializers.ValidationError({"parent": "A category cannot be its own parent."})

        # Keep top-level categories unique per pharmacy by name, while allowing
        # sub-categories with same name under different parents.
        if request_pharmacy_id:
            existing = MedicineCategory.objects.filter(
                pharmacy_id=request_pharmacy_id,
                parent=parent,
                name__iexact=name,
            )
            if self.instance:
                existing = existing.exclude(id=self.instance.id)
            if existing.exists():
                raise serializers.ValidationError({"name": "Category already exists under this parent."})
        return attrs

    class Meta:
        model = MedicineCategory
        fields = [
            "id",
            "name",
            "color",
            "parent",
            "is_active",
            "rule_type",
            "allow_loose_sale",
            "base_unit_label",
            "retail_pack_label",
            "outer_pack_label",
        ]
        read_only_fields = ["id"]


class MedicineBatchSerializer(serializers.ModelSerializer):
    pharmacy_id = serializers.UUIDField(read_only=True)
    medicine_name = serializers.CharField(source="medicine.name", read_only=True)
    quantity = serializers.SerializerMethodField()

    class Meta:
        model = MedicineBatch
        fields = [
            "id",
            "pharmacy_id",
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
    pharmacy_id = serializers.UUIDField(read_only=True)
    medicine_name = serializers.CharField(source="medicine.name", read_only=True)
    batch_no = serializers.CharField(source="batch.batch_no", read_only=True)

    class Meta:
        model = StockLedger
        fields = [
            "id",
            "pharmacy_id",
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

