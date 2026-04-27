from django.db import IntegrityError, transaction
from decimal import Decimal
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db.models import F, Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView

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


def _get_pharmacy_branch(request):
    """
    Return the active pharmacy branch Hospital for this request.

    Priority:
      1. ``request.pharmacy_branch``  — set by PharmacyBranchMiddleware when
         the frontend sends ``X-Pharmacy-Branch: <uuid>`` (i.e. pharmacy role).
      2. ``request.user.pharmacy``      — fallback for non-pharmacy roles or
         when the header is absent.
    """
    return getattr(request, "pharmacy_branch", None) or getattr(request.user, "hospital", None)


class PharmacyOutletSettingsView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/pharmacy/settings/ — letterhead & compliance fields for print."""

    serializer_class = PharmacyOutletSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        hospital = _get_pharmacy_branch(self.request)
        if hospital is None:
            from rest_framework.exceptions import NotFound
            raise NotFound("Hospital context required.")
        obj, _ = PharmacyOutletSettings.objects.get_or_create(
            pharmacy=hospital,
            defaults={"business_name": hospital.name or ""},
        )
        return obj


class PharmacyPurchaseChallanView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        ser = PurchaseChallanSerializer(data=request.data, context={"request": request})
        if not ser.is_valid():
            return Response({"success": False, "errors": ser.errors}, status=status.HTTP_400_BAD_REQUEST)
        hospital = _get_pharmacy_branch(request)
        if hospital is None:
            return Response({"success": False, "detail": "Hospital context required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            vd = ser.validated_data
            lines = process_purchase_challan(
                request=request,
                pharmacy=hospital,
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
        hospital = _get_pharmacy_branch(self.request)
        if not hospital:
            return PharmacySupplier.objects.none()
        return PharmacySupplier.objects.filter(pharmacy=hospital, is_active=True).order_by("name")


class PharmacyNextInvoiceNumberView(APIView):
    """GET /api/v1/pharmacy/invoice/next-number/ — preview next INV-{YYYY}-{seq} (not reserved)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        hospital = _get_pharmacy_branch(request)
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
        hospital = _get_pharmacy_branch(self.request)
        if hospital is None:
            return PharmacyInvoice.objects.none()
        qs = super().get_queryset().filter(pharmacy=hospital)
        patient_id = self.request.query_params.get("patient")
        ipd_admission = self.request.query_params.get("ipd_admission")
        status_filter = (self.request.query_params.get("status") or "").strip().lower()
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        if ipd_admission:
            qs = qs.filter(ipd_admission_id=ipd_admission)
        if status_filter:
            # Status stored as lowercase in DB (TextChoices value, not name)
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        hospital = _get_pharmacy_branch(self.request)
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
                    pharmacy=hospital,
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
            pharmacy=hospital,
            created_by=self.request.user,
            invoice_no=invoice_no,
            payment_method=payment_method,
            paid_amount=paid_amount,
        )


    @action(detail=False, methods=["post"], url_path="create-draft")
    def create_draft(self, request, *args, **kwargs):
        """
        POST /api/v1/pharmacy/invoices/create-draft/
        Creates a draft invoice + all items in a single atomic transaction.
        Body: { patient, ipd_admission, remarks, items: [{medicine, batch, qty, mrp, rate}] }
        """
        import logging
        import uuid as _uuid
        from .models import PharmacyInvoiceItem

        log = logging.getLogger(__name__)

        hospital = _get_pharmacy_branch(request)
        if hospital is None:
            return Response({"detail": "Pharmacy branch not set."}, status=status.HTTP_400_BAD_REQUEST)

        patient_id = request.data.get("patient")
        if not patient_id:
            return Response({"detail": "patient is required."}, status=status.HTTP_400_BAD_REQUEST)

        items_data = request.data.get("items", [])
        if not items_data:
            return Response({"detail": "At least one item is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                # Generate a collision-safe invoice number (max 10 retries then UUID suffix)
                invoice_no = next_pharmacy_invoice_number(hospital.id)
                for _ in range(10):
                    if not PharmacyInvoice.objects.filter(invoice_no=invoice_no).exists():
                        break
                    invoice_no = next_pharmacy_invoice_number(hospital.id)
                else:
                    # Absolute fallback — extremely unlikely to collide
                    invoice_no = f"INV-DRAFT-{str(_uuid.uuid4())[:8].upper()}"

                invoice = PharmacyInvoice.objects.create(
                    pharmacy=hospital,
                    patient_id=patient_id,
                    ipd_admission_id=request.data.get("ipd_admission") or None,
                    invoice_no=invoice_no,
                    status="draft",
                    payment_method="cash",
                    paid_amount=Decimal("0.00"),
                    subtotal=Decimal("0.00"),
                    grand_total=Decimal("0.00"),
                    cgst=Decimal("0.00"),
                    sgst=Decimal("0.00"),
                    remarks=request.data.get("remarks", ""),
                    created_by=request.user,
                )

                item_objs = []
                for item in items_data:
                    item_objs.append(PharmacyInvoiceItem(
                        invoice=invoice,
                        medicine_id=item["medicine"],
                        batch_id=item.get("batch") or None,
                        qty=Decimal(str(item.get("qty", "1"))),
                        mrp=Decimal(str(item.get("mrp", "0"))),
                        rate=Decimal(str(item.get("rate", "0"))),
                        amount=Decimal(str(item.get("amount", "0"))),
                        cgst_rate=Decimal("0.00"),
                        sgst_rate=Decimal("0.00"),
                    ))

                PharmacyInvoiceItem.objects.bulk_create(item_objs)

                serializer = self.get_serializer(invoice)
                return Response({"success": True, "data": serializer.data}, status=status.HTTP_201_CREATED)

        except Exception as exc:
            log.exception("create_draft failed for patient=%s pharmacy=%s", patient_id, hospital.id)
            return Response(
                {"detail": f"Failed to create draft: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )



    @action(detail=False, methods=["get"], url_path="all-drafts")
    def all_drafts(self, request, *args, **kwargs):
        """
        GET /api/v1/pharmacy/invoices/all-drafts/
        Returns ALL draft invoices across every hospital — so pharmacists can see
        doctor-created drafts even if the doctor was scoped to a different hospital.
        """
        qs = (
            PharmacyInvoice.objects.filter(status="draft")
            .select_related("patient", "created_by")
            .prefetch_related("items")
            .order_by("-created_at")
        )
        serializer = self.get_serializer(qs, many=True)
        return Response({"success": True, "data": serializer.data})

    @action(detail=True, methods=["delete"], url_path="delete-draft")
    def delete_draft(self, request, pk=None, *args, **kwargs):
        """
        DELETE /api/v1/pharmacy/invoices/{id}/delete-draft/
        Deletes a draft invoice by UUID without hospital scoping —
        so pharmacists can delete doctor-created drafts across hospitals.
        Only allows deletion of DRAFT status invoices.
        """
        try:
            invoice = PharmacyInvoice.objects.get(pk=pk, status="draft")
        except PharmacyInvoice.DoesNotExist:
            return Response({"detail": "Draft not found."}, status=status.HTTP_404_NOT_FOUND)
        invoice.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

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


class PharmacyInvoiceItemViewSet(viewsets.ModelViewSet):
    queryset = PharmacyInvoiceItem.objects.all()
    serializer_class = PharmacyInvoiceItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        hospital = _get_pharmacy_branch(self.request)
        if hospital is None:
            return PharmacyInvoiceItem.objects.none()
        return super().get_queryset().filter(invoice__pharmacy=hospital)

    @transaction.atomic
    def perform_create(self, serializer):
        item = serializer.save()
        inv = item.invoice
        hospital = inv.pharmacy
        batch = item.batch
        allow_expired = str(self.request.query_params.get("allow_expired", "")).lower() in ("1", "true", "yes")
        if (
            batch.expiry_date
            and batch.expiry_date < timezone.now().date()
            and not allow_expired
        ):
            raise serializers.ValidationError({"batch": ["This batch is expired and cannot be sold."]})
        if inv.status == PharmacyInvoice.Status.FINALIZED:
            available = get_batch_available_qty(batch)
            if available < item.qty:
                raise serializers.ValidationError(
                    {"qty": [f"Insufficient stock for batch {batch.batch_no}. Available {available}, requested {item.qty}."]}
                )
            try:
                deduct_stock_fifo(
                    request=self.request,
                    pharmacy=hospital,
                    medicine_batch_pairs=[(batch, item.qty)],
                    reference_id=str(inv.id),
                )
            except ValueError as exc:
                raise serializers.ValidationError({"non_field_errors": [str(exc)]}) from exc


class PurchaseHistoryListView(APIView):
    """GET /api/v1/pharmacy/purchase-history/ — paginated tiles for Marg-style dashboard."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        hospital = _get_pharmacy_branch(request)
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
            pharmacy_id=hospital.id,
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
        hospital = _get_pharmacy_branch(request)
        if hospital is None:
            return Response({"success": False, "detail": "Hospital context required."}, status=status.HTTP_400_BAD_REQUEST)
        data = detail_purchase_history(pharmacy_id=hospital.id, pk=pk)
        if not data:
            return Response({"success": False, "detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return success_response(data)


class DoctorStockSearchView(APIView):
    """
    GET /api/v1/pharmacy/doctor-stock-search/?pharmacy_id=<uuid>&q=<query>

    Allows any authenticated user (e.g. Doctors) to search pharmacy stock
    by explicitly providing the target pharmacy pharmacy_id as a query param.
    No X-Pharmacy-Branch header needed — works from any portal/role.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        from apps.inventory.models import Medicine, MedicineBatch
        from apps.inventory.services.stock_service import get_batch_available_qty
        from apps.shared.models import Hospital
        from django.db.models import Q
        from django.utils import timezone
        import uuid as uuid_module

        pharmacy_id = (request.query_params.get("pharmacy_id") or "").strip()
        q = (request.query_params.get("q") or "").strip()

        if len(q) < 2:
            return success_response([])

        if not pharmacy_id:
            return Response({"success": False, "detail": "pharmacy_id is required."}, status=400)

        try:
            # Look up any active hospital — not restricted to is_pharmacy
            # because some setups store all medicines in the main hospital
            pharmacy = Pharmacy.objects.get(id=uuid_module.UUID(pharmacy_id), is_active=True)
        except (Pharmacy.DoesNotExist, ValueError):
            return Response({"success": False, "detail": "Invalid pharmacy branch."}, status=400)

        hid = pharmacy.id

        # If this pharmacy branch has no medicines, fall back to the requester's
        # own hospital (which typically holds all the shared medicine catalogue)
        from apps.inventory.models import Medicine as _Med
        if not _Med.objects.filter(pharmacy_id=hid, is_active=True).exists():
            fallback_hid = getattr(getattr(request.user, 'hospital', None), 'id', None)
            if fallback_hid:
                hid = fallback_hid


        def _pack_size(med):
            conv = med.unit_conversions or {}
            for key in ("strip", "STRIP", "box", "BOX", "carton", "CARTON"):
                v = conv.get(key)
                if v is not None:
                    try:
                        n = int(float(v))
                        if n > 0:
                            return n
                    except (TypeError, ValueError):
                        continue
            return 1

        def _exp_status(expiry_date):
            if not expiry_date:
                return "ok", None
            today = timezone.now().date()
            if expiry_date < today:
                return "expired", (expiry_date - today).days
            days = (expiry_date - today).days
            return ("expiring", days) if days <= 60 else ("ok", days)

        med_qs = (
            Medicine.objects.filter(pharmacy_id=hid, is_active=True)
            .filter(Q(name__icontains=q) | Q(sku__icontains=q))
            .select_related("unit")
            .order_by("name")[:25]
        )

        out = []
        for med in med_qs:
            pack_size = _pack_size(med)
            batches = (
                MedicineBatch.objects.filter(medicine_id=med.id, pharmacy_id=hid)
                .order_by("expiry_date", "batch_no")
            )
            for b in batches:
                stock = float(get_batch_available_qty(b))
                st, days = _exp_status(b.expiry_date)
                out.append({
                    "medicine": {
                        "id": str(med.id),
                        "name": med.name,
                        "sku": med.sku,
                        "pack_info": med.pack_info or "",
                        "hsn_code": med.hsn_code or "",
                        "gst_percent": str(med.gst_percent),
                        "unit_conversions": med.unit_conversions or {},
                        "unit_name": med.unit.name if med.unit_id else "",
                        "pack_size": pack_size,
                        "form": med.form or "",
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
                })

        out.sort(key=lambda r: (
            0 if r["expiry_status"] == "ok" else 1 if r["expiry_status"] == "expiring" else 2,
            r["batch"]["expiry_date"] or "9999-12-31",
            r["medicine"]["name"],
        ))
        return success_response(out[:80])
