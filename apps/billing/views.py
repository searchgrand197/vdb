from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.billing.models import BillingInvoice, InvoiceItem, InvoiceNumberSequence
from apps.billing.serializers import (
    BillingInvoiceCreateSerializer,
    BillingInvoiceItemInputSerializer,
    BillingInvoiceSerializer,
)
from apps.roles_permissions.permissions import HasRequiredPermission
from apps.auditlogs.services import create_audit_log
from apps.shared.response import success_response


def _generate_invoice_no(hospital, year: int) -> str:
    seq, _ = InvoiceNumberSequence.objects.select_for_update().get_or_create(hospital=hospital, year=year)
    seq.last_seq += 1
    seq.save(update_fields=["last_seq"])
    return f"{hospital.slug[:10].upper()}-{year}-{seq.last_seq:06d}"


class BillingInvoiceViewSet(viewsets.ModelViewSet):
    queryset = BillingInvoice.objects.all().select_related("patient", "hospital")
    filter_backends = (SearchFilter,)
    search_fields = ("invoice_no", "patient__uhid", "patient__phone")

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]
    http_method_names = ["get", "post"]

    required_permission_map = {
        "list": "billing.view_invoice",
        "retrieve": "billing.view_invoice",
        "create": "billing.create_invoice",
        "update": "billing.update_invoice",
        "partial_update": "billing.update_invoice",
        "destroy": "billing.delete_invoice",
        "finalize": "billing.approve_invoice",
        "cancel": "billing.approve_invoice",
    }

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return BillingInvoiceSerializer
        return BillingInvoiceCreateSerializer

    def get_required_permission(self) -> str | None:
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.is_superuser:
            return qs
        return qs.filter(hospital_id=self.request.user.hospital_id)

    def create(self, request, *args, **kwargs):
        serializer = BillingInvoiceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        patient = serializer.validated_data["patient"]
        hospital = patient.hospital
        hospital_id = request.user.hospital_id
        if not request.user.is_superuser and hospital_id and hospital_id != hospital.id:
            return Response(
                {"success": False, "errors": {"patient": ["Patient does not belong to your hospital."]}},
                status=status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            year = timezone.now().year
            invoice_no = _generate_invoice_no(hospital, year)
            status_value = serializer.validated_data.get("status") or BillingInvoice.Status.DRAFT

            invoice = BillingInvoice.objects.create(
                hospital=hospital,
                invoice_no=invoice_no,
                encounter_type=serializer.validated_data.get("encounter_type", BillingInvoice.EncounterType.OPD),
                patient=patient,
                opd_visit=serializer.validated_data.get("opd_visit"),
                ipd_admission=serializer.validated_data.get("ipd_admission"),
                invoice_date=serializer.validated_data.get("invoice_date", timezone.now().date()),
                status=status_value,
                currency=serializer.validated_data.get("currency", "INR"),
                discount_amount=serializer.validated_data.get("discount_amount", Decimal("0.00")),
                tax_rate=serializer.validated_data.get("tax_rate", Decimal("0.00")),
                subtotal_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                total_amount=Decimal("0.00"),
                amount_paid=Decimal("0.00"),
            )

            items = serializer.validated_data["items"]
            for item in items:
                qty = item["quantity"]
                unit_price = item["unit_price"]
                line_total = (qty * unit_price).quantize(Decimal("0.01"))
                InvoiceItem.objects.create(
                    invoice=invoice,
                    description=item["description"],
                    category=item.get("category", ""),
                    subcategory=item.get("subcategory", ""),
                    quantity=qty,
                    unit_price=unit_price,
                    line_total=line_total,
                )

            invoice.recalc_totals()
            invoice.save(update_fields=["subtotal_amount", "tax_amount", "total_amount"])

            create_audit_log(
                request=request,
                hospital=hospital,
                module="billing",
                action="create_invoice",
                obj=invoice,
                after={
                    "invoice_no": invoice.invoice_no,
                    "total_amount": str(invoice.total_amount),
                    "status": invoice.status,
                },
            )

        return success_response(data=BillingInvoiceSerializer(invoice).data, status_code=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        invoice: BillingInvoice = serializer.instance
        if invoice.status != BillingInvoice.Status.DRAFT:
            raise ValueError("Only draft invoices can be updated.")  # handled by exception handler
        serializer.save()

    @action(detail=True, methods=["post"], url_path="finalize")
    def finalize(self, request, pk=None):
        invoice: BillingInvoice = self.get_object()
        if invoice.status != BillingInvoice.Status.DRAFT:
            return Response(
                {"success": False, "errors": {"detail": ["Only draft invoices can be finalized."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invoice.status = BillingInvoice.Status.FINALIZED
        invoice.save(update_fields=["status"])
        create_audit_log(
            request=request,
            hospital=invoice.hospital,
            module="billing",
            action="finalize_invoice",
            obj=invoice,
            before={"status": BillingInvoice.Status.DRAFT},
            after={"status": invoice.status},
        )
        return success_response(data=BillingInvoiceSerializer(invoice).data, message="Invoice finalized.")

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        invoice: BillingInvoice = self.get_object()
        reason = request.data.get("reason") or ""
        if invoice.status == BillingInvoice.Status.CANCELLED:
            return success_response(data=BillingInvoiceSerializer(invoice).data)
        before_status = invoice.status
        invoice.status = BillingInvoice.Status.CANCELLED
        invoice.cancelled_reason = reason
        invoice.cancelled_at = timezone.now()
        invoice.save(update_fields=["status", "cancelled_reason", "cancelled_at"])
        create_audit_log(
            request=request,
            hospital=invoice.hospital,
            module="billing",
            action="cancel_invoice",
            obj=invoice,
            before={"status": before_status},
            after={"status": invoice.status, "cancelled_reason": invoice.cancelled_reason},
        )
        return success_response(data=BillingInvoiceSerializer(invoice).data, message="Invoice cancelled.")

from django.shortcuts import render

# Create your views here.
