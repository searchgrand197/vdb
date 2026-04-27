from django.db import IntegrityError, transaction
from decimal import Decimal
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db.models import F
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.inventory.models import Medicine, MedicineBatch, StockLedger
from apps.inventory.services.stock_service import deduct_stock_fifo, get_batch_available_qty

from apps.pharmacy.invoice_number import next_pharmacy_invoice_number
from apps.pharmacy.models import PharmacyInvoice, PharmacyInvoiceItem, PharmacyOutletSettings, PharmacySupplier
from apps.pharmacy.purchase_challan import process_purchase_challan
from apps.pharmacy.purchase_history import detail_purchase_history, list_purchase_history
from apps.pharmacy.serializers import (
    PharmacyInvoiceItemSerializer,
    PharmacyInvoiceSerializer,
    PharmacyOutletSettingsSerializer,
    PharmacySupplierSerializer,
    PurchaseChallanSerializer,
)
from apps.shared.response import success_response


class PharmacyOutletSettingsView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/pharmacy/settings/ — letterhead & compliance fields for print."""

    serializer_class = PharmacyOutletSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        hospital = getattr(self.request.user, "hospital", None)
        if hospital is None:
            from rest_framework.exceptions import NotFound

            raise NotFound("Hospital context required.")
        obj, _ = PharmacyOutletSettings.objects.get_or_create(
            hospital=hospital,
            defaults={"business_name": hospital.name or ""},
        )
        return obj


class PharmacyPurchaseChallanView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        ser = PurchaseChallanSerializer(data=request.data, context={"request": request})
        if not ser.is_valid():
            return Response({"success": False, "errors": ser.errors}, status=status.HTTP_400_BAD_REQUEST)
        hospital = getattr(request.user, "hospital", None)
        if hospital is None:
            return Response({"success": False, "detail": "Hospital context required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            vd = ser.validated_data
            lines = process_purchase_challan(
                request=request,
                hospital=hospital,
                lines=vd["lines"],
                supplier_id=vd.get("supplier_id"),
                invoice_no=(vd.get("invoice_no") or "").strip(),
                purchase_date=vd.get("purchase_date"),
                payment_type=vd.get("payment_type") or "cash",
                gst_enabled=vd.get("gst_enabled", True),
            )
        except ValueError as exc:
            return Response({"success": False, "detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return success_response({"lines": lines}, message="Purchase posted.")


class PharmacySupplierViewSet(viewsets.ModelViewSet):
    """CRUD + search for purchase parties (supplier master)."""

    serializer_class = PharmacySupplierSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ("name", "phone", "gst_number")

    def get_queryset(self):
        user = self.request.user
        hid = getattr(user, "hospital_id", None)
        if not hid:
            return PharmacySupplier.objects.none()
        return PharmacySupplier.objects.filter(hospital_id=hid, is_active=True).order_by("name")


class PharmacyNextInvoiceNumberView(APIView):
    """GET /api/v1/pharmacy/invoice/next-number/ — preview next INV-{YYYY}-{seq} (not reserved)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        hospital = getattr(request.user, "hospital", None)
        if hospital is None:
            return Response({"success": False, "detail": "Hospital context required."}, status=status.HTTP_400_BAD_REQUEST)
        return success_response({"invoice_no": next_pharmacy_invoice_number(hospital.id)})


class PharmacyInvoiceViewSet(viewsets.ModelViewSet):
    queryset = PharmacyInvoice.objects.all().order_by("-created_at")
    serializer_class = PharmacyInvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [SearchFilter]
    search_fields = ["invoice_no", "patient__first_name", "patient__last_name", "patient__uhid"]

    def get_queryset(self):
        qs = super().get_queryset().filter(hospital=self.request.user.hospital)
        patient_id = self.request.query_params.get("patient")
        ipd_admission = self.request.query_params.get("ipd_admission")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        if ipd_admission:
            qs = qs.filter(ipd_admission_id=ipd_admission)
        return qs

    def perform_create(self, serializer):
        hospital = self.request.user.hospital
        raw = (serializer.validated_data.get("invoice_no") or "").strip()
        if raw and not PharmacyInvoice.objects.filter(invoice_no=raw).exists():
            invoice_no = raw
        else:
            invoice_no = next_pharmacy_invoice_number(hospital.id)
            while PharmacyInvoice.objects.filter(invoice_no=invoice_no).exists():
                invoice_no = next_pharmacy_invoice_number(hospital.id)
        payment_method = (serializer.validated_data.get("payment_method") or "cash").lower()
        grand_total = serializer.validated_data.get("grand_total") or Decimal("0.00")
        paid_amount = serializer.validated_data.get("paid_amount")
        if payment_method == "credit":
            paid_amount = Decimal("0.00")
        elif paid_amount is None:
            paid_amount = grand_total
        for _ in range(3):
            try:
                serializer.save(
                    hospital=hospital,
                    created_by=self.request.user,
                    invoice_no=invoice_no,
                    payment_method=payment_method,
                    paid_amount=paid_amount,
                )
                return
            except IntegrityError:
                invoice_no = next_pharmacy_invoice_number(hospital.id)
                while PharmacyInvoice.objects.filter(invoice_no=invoice_no).exists():
                    invoice_no = next_pharmacy_invoice_number(hospital.id)
        # If all retries fail, bubble up the final DB integrity error.
        serializer.save(
            hospital=hospital,
            created_by=self.request.user,
            invoice_no=invoice_no,
            payment_method=payment_method,
            paid_amount=paid_amount,
        )

    @action(detail=False, methods=["get"], url_path="pending-credits")
    def pending_credits(self, request, *args, **kwargs):
        qs = (
            self.get_queryset()
            .select_related("patient")
            .filter(payment_method="credit")
            .exclude(status=PharmacyInvoice.Status.CANCELLED)
            .order_by("-date", "-created_at")
        )
        search = (request.query_params.get("search") or "").strip()
        patient_id = (request.query_params.get("patient_id") or "").strip()
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        if search:
            qs = qs.filter(
                Q(invoice_no__icontains=search)
                | Q(patient__first_name__icontains=search)
                | Q(patient__last_name__icontains=search)
                | Q(patient__uhid__icontains=search)
                | Q(patient__phone__icontains=search)
            )

        patients: dict[str, dict] = {}
        total_pending = Decimal("0.00")
        for inv in qs:
            due = (inv.grand_total or Decimal("0")) - (inv.paid_amount or Decimal("0"))
            if due <= 0:
                continue
            pid = str(inv.patient_id)
            row = patients.get(pid)
            if row is None:
                first_name = (inv.patient.first_name or "").strip()
                last_name = (inv.patient.last_name or "").strip()
                row = {
                    "patient_id": pid,
                    "patient_name": " ".join([x for x in [first_name, last_name] if x]).strip() or "Unknown",
                    "uhid": inv.patient.uhid or "",
                    "phone": inv.patient.phone or "",
                    "total_pending_amount": Decimal("0.00"),
                    "bills": [],
                }
                patients[pid] = row
            row["total_pending_amount"] += due
            row["bills"].append(
                {
                    "id": str(inv.id),
                    "invoice_no": inv.invoice_no,
                    "date": inv.date.isoformat() if inv.date else None,
                    "grand_total": str(inv.grand_total or Decimal("0.00")),
                    "paid_amount": str(inv.paid_amount or Decimal("0.00")),
                    "due_amount": str(due),
                    "ipd_admission": str(inv.ipd_admission_id) if inv.ipd_admission_id else None,
                    "status": inv.status,
                }
            )
            total_pending += due

        rows = []
        for row in patients.values():
            row["total_pending_amount"] = str(row["total_pending_amount"])
            row["bill_count"] = len(row["bills"])
            rows.append(row)
        rows.sort(key=lambda r: Decimal(r["total_pending_amount"]), reverse=True)
        return success_response(
            rows,
            meta={
                "total_patients": len(rows),
                "total_pending_amount": str(total_pending),
            },
        )

    @action(detail=True, methods=["patch"], url_path="update-full")
    @transaction.atomic
    def update_full(self, request, *args, **kwargs):
        """
        Edit invoice in one transaction:
        - update patient details
        - replace invoice items
        - reverse old stock + deduct new stock
        - recalculate and persist invoice totals
        """
        invoice: PharmacyInvoice = self.get_object()
        payload = request.data or {}
        patient_payload = payload.get("patient") or {}
        invoice_payload = payload.get("invoice") or {}
        items_payload = payload.get("items") or []

        if not isinstance(items_payload, list) or len(items_payload) == 0:
            return Response(
                {"detail": "At least one medicine item is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1) Update patient details (best-effort editable fields used by frontend)
        patient = invoice.patient
        if isinstance(patient_payload, dict) and patient_payload:
            first_name = (patient_payload.get("first_name") or "").strip()
            last_name = (patient_payload.get("last_name") or "").strip()
            patient.first_name = first_name or patient.first_name
            patient.last_name = last_name

            phone = (patient_payload.get("phone") or "").strip()
            if phone:
                patient.phone = phone
            gender = (patient_payload.get("gender") or "").strip()
            if gender:
                patient.gender = gender
            age = patient_payload.get("age")
            if age not in (None, ""):
                patient.age = age

            guardian_name = patient_payload.get("guardian_name")
            if guardian_name is not None:
                try:
                    if hasattr(patient, "guardian") and patient.guardian is not None:
                        patient.guardian.name = guardian_name or ""
                        patient.guardian.save(update_fields=["name", "updated_at"])
                except Exception:
                    pass

            address_line1 = patient_payload.get("address_line1")
            city = patient_payload.get("city")
            state = patient_payload.get("state")
            if address_line1 is not None or city is not None or state is not None:
                try:
                    if hasattr(patient, "address") and patient.address is not None:
                        if address_line1 is not None:
                            patient.address.line1 = address_line1 or ""
                        if city is not None:
                            patient.address.city = city or ""
                        if state is not None:
                            patient.address.state = state or ""
                        patient.address.save(update_fields=["line1", "city", "state", "updated_at"])
                except Exception:
                    pass

            patient.save()

        # 2) Restore stock for old items before replacing items
        old_items = list(invoice.items.select_related("batch").all())
        for old in old_items:
            if old.batch_id and (old.qty or Decimal("0")) > 0:
                StockLedger.objects.create(
                    hospital_id=invoice.hospital_id,
                    medicine_id=old.medicine_id,
                    batch_id=old.batch_id,
                    qty_change=Decimal(old.qty),
                    reason=StockLedger.Reason.RETURN_IN,
                    reference_type="pharmacy_invoice_edit",
                    reference_id=str(invoice.id),
                    created_by=request.user,
                )
        invoice.items.all().delete()

        # 3) Validate and create new items; collect stock deductions
        subtotal = Decimal("0.00")
        cgst_total = Decimal("0.00")
        sgst_total = Decimal("0.00")
        deductions = []

        for idx, row in enumerate(items_payload):
            if not isinstance(row, dict):
                return Response({"detail": f"Invalid item at row {idx + 1}."}, status=status.HTTP_400_BAD_REQUEST)

            med_id = row.get("medicine")
            batch_id = row.get("batch")
            if not med_id or not batch_id:
                return Response(
                    {"detail": f"Medicine and batch are required at row {idx + 1}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            medicine = Medicine.objects.filter(id=med_id).first()
            if medicine is None:
                return Response({"detail": f"Invalid medicine at row {idx + 1}."}, status=status.HTTP_400_BAD_REQUEST)

            batch = MedicineBatch.objects.filter(
                id=batch_id,
                hospital_id=invoice.hospital_id,
                medicine_id=medicine.id,
            ).first()
            if batch is None:
                return Response({"detail": f"Invalid batch at row {idx + 1}."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                qty = Decimal(str(row.get("qty") or "0"))
                mrp = Decimal(str(row.get("mrp") or "0"))
                rate = Decimal(str(row.get("rate") or "0"))
                cgst_rate = Decimal(str(row.get("cgst_rate") or "0"))
                sgst_rate = Decimal(str(row.get("sgst_rate") or "0"))
            except Exception:
                return Response({"detail": f"Invalid numeric values at row {idx + 1}."}, status=status.HTTP_400_BAD_REQUEST)

            if qty <= 0:
                return Response({"detail": f"Quantity must be > 0 at row {idx + 1}."}, status=status.HTTP_400_BAD_REQUEST)

            base_amount = (qty * rate).quantize(Decimal("0.01"))
            line_cgst = (base_amount * cgst_rate / Decimal("100")).quantize(Decimal("0.01"))
            line_sgst = (base_amount * sgst_rate / Decimal("100")).quantize(Decimal("0.01"))
            line_total = (base_amount + line_cgst + line_sgst).quantize(Decimal("0.01"))

            PharmacyInvoiceItem.objects.create(
                invoice=invoice,
                medicine=medicine,
                batch=batch,
                qty=qty,
                mrp=mrp,
                rate=rate,
                cgst_rate=cgst_rate,
                sgst_rate=sgst_rate,
                amount=line_total,
            )
            deductions.append((batch, qty))
            subtotal += base_amount
            cgst_total += line_cgst
            sgst_total += line_sgst

        # 4) Check stock then deduct for new items
        for batch, qty in deductions:
            available = get_batch_available_qty(batch)
            if available < qty:
                return Response(
                    {"detail": f"Insufficient stock for batch {batch.batch_no}. Available {available}, requested {qty}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        deduct_stock_fifo(
            request=request,
            hospital=invoice.hospital,
            medicine_batch_pairs=deductions,
            reference_id=str(invoice.id),
        )

        # 5) Recalculate invoice totals and save editable invoice fields
        total_discount = Decimal(str(invoice_payload.get("total_discount") or invoice.total_discount or "0"))
        if total_discount < 0:
            total_discount = Decimal("0")
        grand_total = (subtotal - total_discount + cgst_total + sgst_total).quantize(Decimal("0.01"))
        if grand_total < 0:
            grand_total = Decimal("0.00")

        payment_method = (invoice_payload.get("payment_method") or invoice.payment_method or "cash").lower()
        if payment_method == "credit":
            paid_amount = Decimal("0.00")
        else:
            try:
                paid_amount = Decimal(str(invoice_payload.get("paid_amount") if invoice_payload.get("paid_amount") is not None else invoice.paid_amount))
            except Exception:
                paid_amount = Decimal("0.00")
            if paid_amount < 0:
                paid_amount = Decimal("0.00")
            if paid_amount > grand_total:
                paid_amount = grand_total

        invoice.subtotal = subtotal.quantize(Decimal("0.01"))
        invoice.total_discount = total_discount.quantize(Decimal("0.01"))
        invoice.cgst = cgst_total.quantize(Decimal("0.01"))
        invoice.sgst = sgst_total.quantize(Decimal("0.01"))
        invoice.grand_total = grand_total
        invoice.payment_method = payment_method
        invoice.paid_amount = paid_amount.quantize(Decimal("0.01"))
        if "remarks" in invoice_payload:
            invoice.remarks = invoice_payload.get("remarks") or ""
        if "date" in invoice_payload and invoice_payload.get("date"):
            parsed = parse_date(str(invoice_payload.get("date")))
            if parsed:
                invoice.date = parsed
        invoice.save()

        serializer = self.get_serializer(invoice)
        return success_response(serializer.data, message="Invoice updated")


class PharmacyInvoiceItemViewSet(viewsets.ModelViewSet):
    queryset = PharmacyInvoiceItem.objects.all()
    serializer_class = PharmacyInvoiceItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().filter(invoice__hospital=self.request.user.hospital)

    @transaction.atomic
    def perform_create(self, serializer):
        item = serializer.save()
        inv = item.invoice
        hospital = inv.hospital
        batch = item.batch
        allow_expired = str(self.request.query_params.get("allow_expired", "")).lower() in ("1", "true", "yes")
        if (
            batch.expiry_date
            and batch.expiry_date < timezone.now().date()
            and not allow_expired
        ):
            raise serializers.ValidationError({"batch": ["This batch is expired and cannot be sold."]})
        available = get_batch_available_qty(batch)
        if available < item.qty:
            raise serializers.ValidationError(
                {"qty": [f"Insufficient stock for batch {batch.batch_no}. Available {available}, requested {item.qty}."]}
            )
        try:
            deduct_stock_fifo(
                request=self.request,
                hospital=hospital,
                medicine_batch_pairs=[(batch, item.qty)],
                reference_id=str(inv.id),
            )
        except ValueError as exc:
            raise serializers.ValidationError({"non_field_errors": [str(exc)]}) from exc


class PurchaseHistoryListView(APIView):
    """GET /api/v1/pharmacy/purchase-history/ — paginated tiles for Marg-style dashboard."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        hospital = getattr(request.user, "hospital", None)
        if hospital is None:
            return Response({"success": False, "detail": "Hospital context required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            limit = max(1, min(int(request.query_params.get("limit", 20)), 100))
            offset = max(0, int(request.query_params.get("offset", 0)))
        except ValueError:
            limit, offset = 20, 0
        search = (request.query_params.get("search") or "").strip()
        supplier_id = request.query_params.get("supplier_id")
        gst = (request.query_params.get("gst") or "all").lower()
        if gst not in ("all", "gst", "non"):
            gst = "all"
        date_from = parse_date(request.query_params.get("date_from", "") or "")
        date_to = parse_date(request.query_params.get("date_to", "") or "")

        rows, total = list_purchase_history(
            hospital_id=hospital.id,
            limit=limit,
            offset=offset,
            search=search,
            supplier_id=supplier_id if supplier_id else None,
            date_from=date_from,
            date_to=date_to,
            gst=gst,
        )
        return success_response(
            rows,
            meta={"total": total, "limit": limit, "offset": offset, "has_more": offset + len(rows) < total},
        )


class PurchaseHistoryDetailView(APIView):
    """GET /api/v1/pharmacy/purchase-history/<uuid>/ — full challan + lines + return hints."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, *args, **kwargs):
        hospital = getattr(request.user, "hospital", None)
        if hospital is None:
            return Response({"success": False, "detail": "Hospital context required."}, status=status.HTTP_400_BAD_REQUEST)
        data = detail_purchase_history(hospital_id=hospital.id, pk=pk)
        if not data:
            return Response({"success": False, "detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return success_response(data)
