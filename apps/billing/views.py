from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.billing.models import BillingInvoice, InvoiceItem, InvoiceNumberSequence
from apps.payments.models import PaymentTransaction
from apps.billing.collection_attribution import attribution_kwargs, apply_attribution_to_payment
from apps.billing.serializers import (
    BillingInvoiceCreateSerializer,
    BillingInvoiceItemInputSerializer,
    BillingInvoiceSerializer,
)
from apps.roles_permissions.permissions import HasRequiredPermission
from apps.auditlogs.services import create_audit_log
from apps.settings_management.models import ReceptionPortalSettings
from apps.settings_management.document_number_service import render_document_number
from apps.shared.response import success_response


def _generate_invoice_no(hospital, year: int) -> str:
    settings_obj, _ = ReceptionPortalSettings.objects.select_for_update().get_or_create(
        hospital=hospital,
        defaults={"default_city": "Jind", "default_state": "Haryana"},
    )
    seq, _ = InvoiceNumberSequence.objects.select_for_update().get_or_create(hospital=hospital, year=year)
    configured_next = max(int(settings_obj.invoice_next_number or 1), 1)
    if seq.last_seq < configured_next - 1:
        seq.last_seq = configured_next - 1
    seq.last_seq += 1
    seq.save(update_fields=["last_seq"])
    settings_obj.invoice_next_number = seq.last_seq + 1
    settings_obj.save(update_fields=["invoice_next_number"])
    return render_document_number(hospital, "receipt", year, seq.last_seq)


class BillingInvoiceViewSet(viewsets.ModelViewSet):
    queryset = BillingInvoice.objects.all().select_related(
        "patient", "hospital", "attributed_doctor_user", "opd_visit", "ipd_admission"
    )
    filter_backends = (SearchFilter,)
    search_fields = ("invoice_no", "patient__uhid", "patient__phone")

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]
    # PATCH is required for the `update-items` action; generic PATCH on the invoice
    # detail URL is disabled in `partial_update` below.
    http_method_names = ["get", "post", "patch"]

    required_permission_map = {
        "list": "billing.view_invoice",
        "retrieve": "billing.view_invoice",
        "create": "billing.create_invoice",
        "update": "billing.update_invoice",
        "partial_update": "billing.update_invoice",
        "destroy": "billing.delete_invoice",
        "finalize": "billing.approve_invoice",
        "cancel": "billing.approve_invoice",
        "update_items": "billing.update_invoice",
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
            pass
        else:
            qs = qs.filter(hospital_id=self.request.user.hospital_id)
        attribution_type = (self.request.query_params.get("attribution_type") or "").strip()
        if attribution_type:
            qs = qs.filter(attribution_type=attribution_type)
        doctor_id = (self.request.query_params.get("attributed_doctor_user") or "").strip()
        if doctor_id:
            qs = qs.filter(attributed_doctor_user_id=doctor_id)
        return qs

    def partial_update(self, request, *args, **kwargs):
        """Invoice line edits use PATCH …/update-items/ — not this URL."""
        raise MethodNotAllowed("PATCH", detail="Invoice updates must use the update-items endpoint.")

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
            opd_visit = serializer.validated_data.get("opd_visit")
            ipd_admission = serializer.validated_data.get("ipd_admission")
            attr_kwargs = attribution_kwargs(
                opd_visit=opd_visit,
                ipd_admission=ipd_admission,
                requested_type=serializer.validated_data.get("attribution_type"),
                requested_doctor_user=serializer.validated_data.get("attributed_doctor_user"),
            )

            invoice = BillingInvoice.objects.create(
                hospital=hospital,
                invoice_no=invoice_no,
                encounter_type=serializer.validated_data.get("encounter_type", BillingInvoice.EncounterType.OPD),
                patient=patient,
                opd_visit=opd_visit,
                ipd_admission=ipd_admission,
                invoice_date=serializer.validated_data.get("invoice_date", timezone.now().date()),
                status=status_value,
                currency=serializer.validated_data.get("currency", "INR"),
                discount_amount=serializer.validated_data.get("discount_amount", Decimal("0.00")),
                tax_rate=serializer.validated_data.get("tax_rate", Decimal("0.00")),
                subtotal_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                total_amount=Decimal("0.00"),
                amount_paid=Decimal("0.00"),
                attribution_type=attr_kwargs["attribution_type"],
                attributed_doctor_user=attr_kwargs["attributed_doctor_user"],
            )

            items = serializer.validated_data["items"]
            for item in items:
                qty = item["quantity"]
                unit_price = item["unit_price"]
                line_total = (qty * unit_price)
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

    @action(detail=True, methods=["patch"], url_path="update-items")
    @transaction.atomic
    def update_items(self, request, pk=None):
        """Replace all line items on an invoice and recalculate totals."""
        invoice: BillingInvoice = self.get_object()
        if invoice.status == BillingInvoice.Status.CANCELLED:
            return Response(
                {"success": False, "errors": {"detail": ["Cannot edit a cancelled invoice."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        items_data = request.data.get("items")
        if not isinstance(items_data, list) or len(items_data) == 0:
            return Response(
                {"success": False, "errors": {"items": ["At least one item is required."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        item_serializer = BillingInvoiceItemInputSerializer(data=items_data, many=True)
        item_serializer.is_valid(raise_exception=True)

        # Optional invoice-level overrides
        discount_raw = request.data.get("discount_amount")
        tax_rate_raw = request.data.get("tax_rate")
        if discount_raw is not None:
            try:
                invoice.discount_amount = Decimal(str(discount_raw))
            except Exception:
                pass
        if tax_rate_raw is not None:
            try:
                invoice.tax_rate = Decimal(str(tax_rate_raw))
            except Exception:
                pass

        invoice.items.all().delete()
        for item in item_serializer.validated_data:
            qty = item["quantity"]
            unit_price = item["unit_price"]
            InvoiceItem.objects.create(
                invoice=invoice,
                description=item["description"],
                category=item.get("category", ""),
                subcategory=item.get("subcategory", ""),
                quantity=qty,
                unit_price=unit_price,
                line_total=(qty * unit_price),
            )

        invoice.recalc_totals()
        invoice.save(update_fields=["subtotal_amount", "tax_amount", "total_amount", "discount_amount", "tax_rate"])

        create_audit_log(
            request=request,
            hospital=invoice.hospital,
            module="billing",
            action="update_invoice_items",
            obj=invoice,
            after={"invoice_no": invoice.invoice_no, "total_amount": str(invoice.total_amount)},
        )
        return success_response(data=BillingInvoiceSerializer(invoice).data, message="Invoice items updated.")

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
    @transaction.atomic
    def cancel(self, request, pk=None):
        invoice: BillingInvoice = self.get_object()
        reason = request.data.get("reason") or ""
        if invoice.status == BillingInvoice.Status.CANCELLED:
            return success_response(data=BillingInvoiceSerializer(invoice).data)
        before_status = invoice.status
        ref_note = (reason or "Invoice cancelled")[:100]
        cancel_ref = f"INV-CANCEL:{ref_note}"[:120]
        for p in invoice.payments.filter(
            status=PaymentTransaction.Status.SUCCESS,
            is_deleted=False,
        ):
            p.status = PaymentTransaction.Status.CANCELLED
            p.transaction_reference = cancel_ref
            p.save(update_fields=["status", "transaction_reference"])
        invoice.status = BillingInvoice.Status.CANCELLED
        invoice.cancelled_reason = reason
        invoice.cancelled_at = timezone.now()
        invoice.amount_paid = Decimal("0.00")
        invoice.save(update_fields=["status", "cancelled_reason", "cancelled_at", "amount_paid"])
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
