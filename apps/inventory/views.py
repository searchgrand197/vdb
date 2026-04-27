from __future__ import annotations

import re
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction

from apps.auditlogs.services import create_audit_log
from apps.inventory.models import Medicine, MedicineBatch, MedicineCategory, StockLedger, Unit
from apps.inventory.serializers import (
    MedicineBatchCreateUpdateSerializer,
    MedicineBatchRatesUpdateSerializer,
    MedicineBatchSerializer,
    MedicineCategoryCreateUpdateSerializer,
    MedicineCategorySerializer,
    MedicineCreateUpdateSerializer,
    MedicineSerializer,
    StockLedgerCreateSerializer,
    StockLedgerSerializer,
    UnitCreateUpdateSerializer,
    UnitSerializer,
)
from apps.inventory.services.stock_service import get_batch_available_qty
from apps.roles_permissions.permissions import HasRequiredPermission
from apps.shared.response import success_response
from apps.shared.models import Hospital


def _tablets_per_strip_from_pack_info(pack_info: str) -> int | None:
    """e.g. '1x10' or '1 x 10' → 10 tablets per strip (uses the number after x)."""
    if not pack_info or not str(pack_info).strip():
        return None
    m = re.match(r"^\s*(\d+)\s*[x×]\s*(\d+)\s*$", str(pack_info).strip(), re.I)
    if not m:
        return None
    return int(m.group(2))


def _medicine_pack_size(medicine: Medicine) -> int:
    """Base units per retail pack (strip/box); user-defined via unit_conversions JSON."""
    conv = medicine.unit_conversions or {}
    for key in ("strip", "STRIP", "box", "BOX", "carton", "CARTON"):
        v = conv.get(key)
        if v is not None:
            try:
                n = int(float(v))
                if n > 0:
                    return n
            except (TypeError, ValueError):
                continue
    t = _tablets_per_strip_from_pack_info(medicine.pack_info or "")
    return t if t and t > 0 else 1


def _expiry_status(expiry_date):
    """Return (status, days_to_expiry) where status is expired|expiring|ok."""
    if not expiry_date:
        return "ok", None
    today = timezone.now().date()
    if expiry_date < today:
        return "expired", (expiry_date - today).days
    days = (expiry_date - today).days
    if days <= 60:
        return "expiring", days
    return "ok", days


class HospitalScopedMixin:
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # If the user has a hospital (including superusers), scope to that tenant so lists match
        # pharmacy purchase, billing, and stock rules.
        hid = getattr(user, "hospital_id", None)
        if hid:
            return qs.filter(hospital_id=hid)
        if user.is_superuser:
            return qs
        return qs.filter(hospital_id=user.hospital_id)


class UnitViewSet(HospitalScopedMixin, viewsets.ModelViewSet):
    queryset = Unit.objects.all()
    filter_backends = (DjangoFilterBackend, SearchFilter)
    search_fields = ("code", "name")

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    required_permission_map = {
        "list": "inventory.view_unit",
        "retrieve": "inventory.view_unit",
        "create": "inventory.create_unit",
        "update": "inventory.update_unit",
        "partial_update": "inventory.update_unit",
        "destroy": "inventory.delete_unit",
    }

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return UnitSerializer
        return UnitCreateUpdateSerializer

    def get_required_permission(self):
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def perform_create(self, serializer):
        unit = serializer.save(hospital_id=self.request.user.hospital_id)
        create_audit_log(
            request=self.request,
            hospital=unit.hospital,
            module="inventory",
            action="create_unit",
            obj=unit,
            after={"code": unit.code, "name": unit.name},
        )


class MedicineCategoryViewSet(HospitalScopedMixin, viewsets.ModelViewSet):
    queryset = MedicineCategory.objects.all().select_related("parent").order_by("name")
    filter_backends = (DjangoFilterBackend, SearchFilter)
    search_fields = ("name",)
    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]
    required_permission_map = {
        "list": "inventory.view_medicine",
        "retrieve": "inventory.view_medicine",
        "create": "inventory.create_medicine",
        "update": "inventory.update_medicine",
        "partial_update": "inventory.update_medicine",
        "destroy": "inventory.delete_medicine",
    }

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return MedicineCategorySerializer
        return MedicineCategoryCreateUpdateSerializer

    def get_required_permission(self):
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(hospital_id=self.request.user.hospital_id)


class MedicineViewSet(HospitalScopedMixin, viewsets.ModelViewSet):
    queryset = Medicine.objects.all().select_related("unit")
    filter_backends = (DjangoFilterBackend, SearchFilter)
    search_fields = ("sku", "name")

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    required_permission_map = {
        "list": "inventory.view_medicine",
        "retrieve": "inventory.view_medicine",
        "search": "inventory.view_medicine",
        "create": "inventory.create_medicine",
        "update": "inventory.update_medicine",
        "partial_update": "inventory.update_medicine",
        "destroy": "inventory.delete_medicine",
    }

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return MedicineSerializer
        return MedicineCreateUpdateSerializer

    def get_required_permission(self):
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def perform_create(self, serializer):
        hospital_id = self.request.user.hospital_id
        unit = serializer.validated_data.get("unit")
        if unit is None:
            unit, _ = Unit.objects.get_or_create(
                hospital_id=hospital_id,
                code="TAB",
                defaults={"name": "Tablet", "is_active": True},
            )
            medicine = serializer.save(hospital_id=hospital_id, unit=unit)
        else:
            medicine = serializer.save(hospital_id=hospital_id)

        per_strip = _tablets_per_strip_from_pack_info(medicine.pack_info or "")
        conv = medicine.unit_conversions or {}
        if per_strip and per_strip > 0 and not conv.get("strip"):
            conv = {**conv, "strip": float(per_strip)}
            medicine.unit_conversions = conv
            medicine.save(update_fields=["unit_conversions", "updated_at"])

        create_audit_log(
            request=self.request,
            hospital=medicine.hospital,
            module="inventory",
            action="create_medicine",
            obj=medicine,
            after={"sku": medicine.sku, "name": medicine.name},
        )

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        """
        Pharmacy billing: flat medicine+batch suggestions (Marg-style).
        GET /api/v1/medicines/search/?q=para
        """
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 2:
            return success_response([])
        hid = getattr(request.user, "hospital_id", None)
        if not hid:
            return Response({"success": False, "detail": "Hospital context required."}, status=400)

        med_qs = (
            Medicine.objects.filter(hospital_id=hid, is_active=True)
            .filter(Q(name__icontains=q) | Q(sku__icontains=q))
            .select_related("unit")
            .order_by("name")[:25]
        )

        out = []
        for med in med_qs:
            pack_size = _medicine_pack_size(med)
            batches = (
                MedicineBatch.objects.filter(medicine_id=med.id, hospital_id=hid)
                .order_by("expiry_date", "batch_no")
            )
            for b in batches:
                stock = float(get_batch_available_qty(b))
                st, days = _expiry_status(b.expiry_date)
                out.append(
                    {
                        "medicine": {
                            "id": str(med.id),
                            "name": med.name,
                            "sku": med.sku,
                            "form": med.form or "",
                            "pack_info": med.pack_info or "",
                            "hsn_code": med.hsn_code or "",
                            "gst_percent": str(med.gst_percent),
                            "unit_conversions": med.unit_conversions or {},
                            "unit_name": med.unit.name if med.unit_id else "",
                            "pack_size": pack_size,
                        },
                        "batch": {
                            "id": str(b.id),
                            "batch_no": b.batch_no,
                            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
                            "mrp": str(b.mrp),
                            "unit_cost": str(b.unit_cost),
                            "sale_rate": str(b.sale_rate),
                            "stock": stock,
                        },
                        "expiry_status": st,
                        "days_to_expiry": days,
                    }
                )

        def sort_key(row):
            st = row["expiry_status"]
            prio = 0 if st == "ok" else 1 if st == "expiring" else 2
            exp = row["batch"]["expiry_date"] or "9999-12-31"
            return (prio, exp, row["medicine"]["name"], row["batch"]["batch_no"])

        out.sort(key=sort_key)
        return success_response(out[:80])


class MedicineBatchViewSet(HospitalScopedMixin, viewsets.ModelViewSet):
    queryset = MedicineBatch.objects.all().select_related("medicine", "medicine__unit")
    filter_backends = (DjangoFilterBackend, SearchFilter)
    search_fields = ("batch_no", "medicine__name")

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    required_permission_map = {
        "list": "inventory.view_batch",
        "retrieve": "inventory.view_batch",
        "create": "inventory.create_batch",
        "update": "inventory.update_batch",
        "partial_update": "inventory.update_batch",
        "destroy": "inventory.delete_batch",
    }

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return MedicineBatchSerializer
        if self.action in {"update", "partial_update"}:
            return MedicineBatchRatesUpdateSerializer
        return MedicineBatchCreateUpdateSerializer

    def get_required_permission(self):
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def perform_create(self, serializer):
        batch = serializer.save(hospital_id=self.request.user.hospital_id)
        create_audit_log(
            request=self.request,
            hospital=batch.hospital,
            module="inventory",
            action="create_batch",
            obj=batch,
            after={"batch_no": batch.batch_no, "expiry_date": str(batch.expiry_date)},
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        refreshed = self.get_queryset().get(pk=instance.pk)
        return Response(MedicineBatchSerializer(refreshed, context={"request": request}).data)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        from apps.pharmacy.models import PharmacyInvoiceItem, PharmacyPurchaseChallanLine

        instance = self.get_object()
        bn = instance.batch_no
        exp = instance.expiry_date
        PharmacyInvoiceItem.objects.filter(batch_id=instance.id).update(
            snapshot_batch_no=bn,
            snapshot_expiry_date=exp,
            batch_id=None,
        )
        PharmacyPurchaseChallanLine.objects.filter(batch_id=instance.id).update(
            snapshot_batch_no=bn,
            snapshot_expiry_date=exp,
            batch_id=None,
        )
        create_audit_log(
            request=request,
            hospital=instance.hospital,
            module="inventory",
            action="delete_batch",
            obj=instance,
            before={
                "batch_no": instance.batch_no,
                "expiry_date": str(instance.expiry_date) if instance.expiry_date else "",
                "medicine_id": str(instance.medicine_id),
            },
        )
        StockLedger.objects.filter(batch_id=instance.id).delete()
        return super().destroy(request, *args, **kwargs)


class StockLedgerViewSet(HospitalScopedMixin, viewsets.ModelViewSet):
    queryset = StockLedger.objects.all().select_related("medicine", "batch", "hospital").order_by("-created_at")
    filter_backends = (DjangoFilterBackend, SearchFilter)
    filterset_fields = ("batch", "medicine")
    search_fields = ("medicine__name", "batch__batch_no", "reference_type", "reference_id")

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    http_method_names = ["get", "post"]

    required_permission_map = {
        "list": "inventory.view_stock_ledger",
        "retrieve": "inventory.view_stock_ledger",
        "create": "inventory.create_stock_ledger",
    }

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return StockLedgerSerializer
        return StockLedgerCreateSerializer

    def get_required_permission(self):
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    @transaction.atomic
    def perform_create(self, serializer):
        data = serializer.validated_data
        medicine_batch = MedicineBatch.objects.select_related("medicine", "hospital").get(pk=data["batch"])
        hospital = medicine_batch.hospital

        if not self.request.user.is_superuser and hospital.id != self.request.user.hospital_id:
            raise permissions.PermissionDenied("Not in your hospital.")

        med_id = data["medicine"]
        if str(med_id) != str(medicine_batch.medicine_id):
            raise ValidationError({"medicine": ["Medicine must match the selected batch."]})

        qty_change = Decimal(data["qty_change"])
        reason = data["reason"]
        if reason in {StockLedger.Reason.STOCK_IN, StockLedger.Reason.RETURN_IN} and qty_change <= 0:
            raise ValidationError({"qty_change": ["Must be greater than zero for stock in / return."]})
        if reason == StockLedger.Reason.DISPENSE_OUT and qty_change >= 0:
            raise ValidationError({"qty_change": ["Must be negative for dispense out."]})

        ref_type = (data.get("reference_type") or "").strip()
        ref_id = (data.get("reference_id") or "").strip()
        allow_negative = bool(data.get("allow_negative_stock", False))

        if reason == StockLedger.Reason.ADJUST:
            if qty_change == 0:
                raise ValidationError({"qty_change": ["Adjustment quantity cannot be zero."]})
            if not ref_id:
                raise ValidationError({"reference_id": ["Reason is required for stock adjustments."]})
            available = get_batch_available_qty(medicine_batch)
            projected = available + qty_change
            if projected < 0 and not allow_negative:
                raise ValidationError(
                    {
                        "qty_change": [
                            f"Resulting stock would be negative ({projected}). Enable allow_negative_stock or reduce the adjustment."
                        ]
                    }
                )
            if not ref_type:
                ref_type = "inventory_adjust"

        entry = StockLedger.objects.create(
            hospital_id=hospital.id,
            medicine_id=med_id,
            batch=medicine_batch,
            qty_change=qty_change,
            reason=reason,
            reference_type=ref_type[:50],
            reference_id=ref_id[:100],
            created_by=self.request.user,
        )

        create_audit_log(
            request=self.request,
            hospital=hospital,
            module="inventory",
            action="create_stock_ledger",
            obj=entry,
            after={"qty_change": str(entry.qty_change), "reason": entry.reason},
        )

        serializer.instance = entry

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            StockLedgerSerializer(serializer.instance, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

from django.shortcuts import render

# Create your views here.
