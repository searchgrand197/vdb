from __future__ import annotations
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response

from apps.ipd.models import IPDAdmission, IPDAdmissionStatusHistory, IPDTransferHistory
from apps.ipd.serializers import IPDAdmissionCreateUpdateSerializer, IPDAdmissionSerializer
from apps.opd.models import OPDVisit
from apps.beds.models import Bed
from apps.billing.models import BillingInvoice, InvoiceItem, InvoiceNumberSequence
from apps.payments.models import PaymentTransaction
from apps.payments.serializers import PaymentTransactionSerializer
from apps.pharmacy.models import PharmacyInvoice
from apps.roles_permissions.permissions import HasRequiredPermission
from apps.auditlogs.services import create_audit_log
from apps.shared.response import success_response


def _occupy_bed(bed_code: str, hospital_id):
    """Mark a bed as OCCUPIED by its bed_code."""
    if bed_code:
        Bed.objects.filter(bed_code=bed_code, hospital_id=hospital_id).update(status=Bed.Status.OCCUPIED)


def _release_bed(bed_code: str, hospital_id):
    """Mark a bed as CLEANING (ready to be cleaned before next use)."""
    if bed_code:
        Bed.objects.filter(bed_code=bed_code, hospital_id=hospital_id).update(status=Bed.Status.CLEANING)
        # Auto-create/refresh cleaning task for housekeeping workflow.
        from apps.beds.services import ensure_cleaning_task_for_bed

        ensure_cleaning_task_for_bed(
            bed_code=bed_code,
            hospital_id=hospital_id,
            notes="Auto-created from discharge/transfer.",
        )


class IPDAdmissionViewSet(viewsets.ModelViewSet):
    queryset = IPDAdmission.objects.all()
    filter_backends = (SearchFilter,)
    search_fields = ("patient__uhid", "admission_diagnosis", "admission_notes", "ward_name", "department", "room_name", "bed_code")

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    required_permission_map = {
        "list": "ipd.view_admission",
        "retrieve": "ipd.view_admission",
        "create": "ipd.create_admission",
        "update": "ipd.update_admission",
        "partial_update": "ipd.update_admission",
        "destroy": "ipd.delete_admission",
        "convert_from_opd": "ipd.create_admission",
    }

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return IPDAdmissionSerializer
        return IPDAdmissionCreateUpdateSerializer

    def get_required_permission(self) -> str | None:
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            scoped = qs
        else:
            scoped = qs.filter(hospital_id=user.hospital_id)

        status_q = (self.request.query_params.get("status") or "").strip().lower()
        if status_q:
            allowed = {k for (k, _v) in IPDAdmission.Status.choices}
            wanted = [s.strip() for s in status_q.split(",") if s.strip() in allowed]
            if wanted:
                scoped = scoped.filter(status__in=wanted)
        return scoped

    @transaction.atomic
    def perform_create(self, serializer):
        # Hospital is derived from the chosen patient/opd_visit to keep tenancy safe.
        hospital_id = None

        patient = serializer.validated_data.get("patient")
        if patient:
            hospital_id = patient.hospital_id

        if not hospital_id:
            opd_visit = serializer.validated_data.get("opd_visit")
            if opd_visit:
                hospital_id = opd_visit.hospital_id

        if not hospital_id:
            hospital_id = self.request.user.hospital_id

        patient = serializer.validated_data.get("patient")
        if patient:
            existing = IPDAdmission.objects.filter(
                hospital_id=hospital_id,
                patient=patient,
                is_deleted=False,
            ).exclude(
                status__in=[IPDAdmission.Status.DISCHARGED, IPDAdmission.Status.CANCELLED]
            ).first()
            if existing:
                raise ValidationError({
                    "patient": [
                        f"Patient already has an active IPD admission ({existing.ipd_no or existing.id}) in "
                        f"{existing.ward_name or 'ward'} / {existing.bed_code or 'bed'}."
                    ]
                })

        admission: IPDAdmission = serializer.save(hospital_id=hospital_id)

        # Mark the selected bed as occupied.
        _occupy_bed(admission.bed_code, hospital_id)

        IPDAdmissionStatusHistory.objects.create(
            admission=admission,
            from_status=admission.status,
            to_status=admission.status,
            changed_by=self.request.user,
        )
        create_audit_log(
            request=self.request,
            hospital=admission.hospital,
            module="ipd",
            action="create_admission",
            obj=admission,
            after={"patient_uhid": admission.patient.uhid, "status": admission.status},
        )

    @transaction.atomic
    def perform_update(self, serializer):
        admission: IPDAdmission = serializer.instance
        hospital_id = admission.hospital_id

        old_status = admission.status
        old_ward = admission.ward_name
        old_room = admission.room_name
        old_bed = admission.bed_code

        serializer.save()

        new_status = admission.status

        # ── Bed status management ──────────────────────────────────────────────
        bed_changed = admission.bed_code != old_bed
        discharged = new_status in (IPDAdmission.Status.DISCHARGED, IPDAdmission.Status.CANCELLED)

        if discharged:
            # Release the bed the patient was in.
            _release_bed(old_bed, hospital_id)
        elif bed_changed:
            # Patient transferred: free old bed, occupy new bed.
            _release_bed(old_bed, hospital_id)
            _occupy_bed(admission.bed_code, hospital_id)
        # ──────────────────────────────────────────────────────────────────────

        if new_status != old_status:
            IPDAdmissionStatusHistory.objects.create(
                admission=admission,
                from_status=old_status,
                to_status=new_status,
                changed_by=self.request.user,
            )
            create_audit_log(
                request=self.request,
                hospital=admission.hospital,
                module="ipd",
                action="update_status",
                obj=admission,
                before={"status": old_status},
                after={"status": new_status},
            )

        # Transfer is triggered if any bed-identifying field changes.
        if (
            admission.ward_name != old_ward
            or admission.room_name != old_room
            or admission.bed_code != old_bed
        ):
            IPDTransferHistory.objects.create(
                admission=admission,
                from_ward_name=old_ward,
                to_ward_name=admission.ward_name,
                from_room_name=old_room,
                to_room_name=admission.room_name,
                from_bed_code=old_bed,
                to_bed_code=admission.bed_code,
                changed_by=self.request.user,
            )
            create_audit_log(
                request=self.request,
                hospital=admission.hospital,
                module="ipd",
                action="transfer_bed",
                obj=admission,
                before={"ward_name": old_ward, "room_name": old_room, "bed_code": old_bed},
                after={"ward_name": admission.ward_name, "room_name": admission.room_name, "bed_code": admission.bed_code},
            )

    @action(detail=False, methods=["post"], url_path="convert-from-opd")
    def convert_from_opd(self, request, *args, **kwargs):
        opd_visit_id = request.data.get("opd_visit_id")
        if not opd_visit_id:
            return Response(
                {"success": False, "errors": {"opd_visit_id": ["This field is required."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = OPDVisit.objects.all()
        if not request.user.is_superuser:
            qs = qs.filter(hospital_id=request.user.hospital_id)

        try:
            opd_visit: OPDVisit = qs.get(pk=opd_visit_id)
        except OPDVisit.DoesNotExist:
            return Response({"success": False, "errors": {"detail": ["OPD visit not found."]}}, status=404)

        admission_data = {
            "patient": opd_visit.patient_id,
            "opd_visit": opd_visit.id,
            "admission_date": timezone.now().date(),
            "expected_discharge_date": request.data.get("expected_discharge_date"),
            "assigned_doctor": request.data.get("assigned_doctor"),
            "assigned_nurse": request.data.get("assigned_nurse"),
            "ward_name": request.data.get("ward_name", ""),
            "department": request.data.get("department", ""),
            "room_name": request.data.get("room_name", ""),
            "bed_code": request.data.get("bed_code", ""),
            "admission_diagnosis": request.data.get("admission_diagnosis") or opd_visit.diagnosis,
            "admission_notes": request.data.get("admission_notes") or opd_visit.consultation_notes,
            "status": IPDAdmission.Status.ADMITTED,
            "discharge_notes": request.data.get("discharge_notes", ""),
        }

        serializer = IPDAdmissionCreateUpdateSerializer(data=admission_data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            admission: IPDAdmission = serializer.save(hospital_id=opd_visit.hospital_id)
            # Mark OPD visit as completed when converted to IPD.
            opd_visit.status = OPDVisit.Status.COMPLETED
            opd_visit.save(update_fields=["status"])

        create_audit_log(
            request=request,
            hospital=admission.hospital,
            module="ipd",
            action="convert_from_opd",
            obj=admission,
            before={"opd_visit_id": str(opd_visit.id), "opd_status": OPDVisit.Status.COMPLETED},
            after={"patient_uhid": admission.patient.uhid, "status": admission.status},
        )

        return success_response(data=IPDAdmissionSerializer(admission).data, status_code=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def payments(self, request, pk=None):
        """List all payments for this admission."""
        admission = self.get_object()
        payments = PaymentTransaction.objects.filter(
            invoice__ipd_admission=admission,
            status=PaymentTransaction.Status.SUCCESS
        ).select_related("invoice", "collected_by").order_by("-created_at")
        return Response(PaymentTransactionSerializer(payments, many=True).data)

    @action(detail=True, methods=["get"])
    def ledger(self, request, pk=None):
        """Calculate running IPD ledger including dynamic room rent."""
        admission = self.get_object()
        stay_end_date = (
            admission.discharged_at.date()
            if admission.status in (IPDAdmission.Status.DISCHARGED, IPDAdmission.Status.CANCELLED) and admission.discharged_at
            else timezone.now().date()
        )
        
        # 1. Invoices (charges):
        # Include directly linked invoices and also fallback IPD invoices/payments
        # created for the same patient during this admission window.
        invoices = BillingInvoice.objects.filter(
            status=BillingInvoice.Status.FINALIZED,
        ).filter(
            Q(ipd_admission=admission)
            | Q(
                ipd_admission__isnull=True,
                encounter_type=BillingInvoice.EncounterType.IPD,
                patient=admission.patient,
                invoice_date__gte=admission.admission_date,
                invoice_date__lte=stay_end_date,
            )
        ).prefetch_related("items").order_by("-created_at")
        
        record_charges = []
        grouped_charge_map = {}
        invoice_to_event_refs = {}
        invoices_total = Decimal("0.00")
        for inv in invoices:
            # Paid advance invoices are deposits, not billable charges.
            if inv.invoice_no.startswith("IPDADV-") and (inv.amount_paid or Decimal("0.00")) > Decimal("0.00"):
                continue
            invoices_total += inv.total_amount
            items = list(inv.items.all())
            invoice_event_refs = []
            invoice_to_event_refs[str(inv.id)] = invoice_event_refs
            invoice_payment_mode = "credit" if (inv.amount_paid or Decimal("0.00")) <= Decimal("0.00") else "cash"

            if inv.invoice_no.startswith("IPDADV-") and (inv.amount_paid or Decimal("0.00")) == Decimal("0.00"):
                desc = "Advance (Credit / Due)"
                quantity = Decimal("1")
                unit_price = inv.total_amount
                charge_date = inv.created_at.isoformat()
                record_charges.append({
                    "id": str(inv.id),
                    "type": "charge",
                    "date": charge_date,
                    "description": desc,
                    "amount": str(inv.total_amount),
                    "invoice_no": inv.invoice_no,
                    "quantity": str(quantity),
                    "unit_price": str(unit_price),
                    "charge_times": [charge_date],
                    "payment_mode": invoice_payment_mode,
                })
                group_key = (desc or "").strip().lower()
                if group_key not in grouped_charge_map:
                    grouped_charge_map[group_key] = {
                        "id": f"grp-{str(inv.id)}",
                        "description": desc,
                        "quantity": Decimal("0.00"),
                        "total_amount": Decimal("0.00"),
                        "total_paid": Decimal("0.00"),
                        "events": [],
                    }
                grouped_charge_map[group_key]["quantity"] += quantity
                grouped_charge_map[group_key]["total_amount"] += inv.total_amount
                event_ref = {
                    "id": str(inv.id),
                    "name": desc,
                    "date": charge_date,
                    "price": str(inv.total_amount),
                    "quantity": str(quantity),
                    "invoice_no": inv.invoice_no,
                    "payment_mode": invoice_payment_mode,
                    "paid_amount": "0.00",
                    "slip_number": "",
                }
                grouped_charge_map[group_key]["events"].append(event_ref)
                invoice_event_refs.append({
                    "group_key": group_key,
                    "event": event_ref,
                    "amount": inv.total_amount,
                })
                continue

            if not items:
                desc = "Service"
                quantity = Decimal("1")
                unit_price = inv.total_amount
                charge_date = inv.created_at.isoformat()
                record_charges.append({
                    "id": str(inv.id),
                    "type": "charge",
                    "date": charge_date,
                    "description": desc,
                    "amount": str(inv.total_amount),
                    "invoice_no": inv.invoice_no,
                    "quantity": str(quantity),
                    "unit_price": str(unit_price),
                    "charge_times": [charge_date],
                    "payment_mode": invoice_payment_mode,
                })
                group_key = (desc or "").strip().lower()
                if group_key not in grouped_charge_map:
                    grouped_charge_map[group_key] = {
                        "id": f"grp-{str(inv.id)}",
                        "description": desc,
                        "quantity": Decimal("0.00"),
                        "total_amount": Decimal("0.00"),
                        "total_paid": Decimal("0.00"),
                        "events": [],
                    }
                grouped_charge_map[group_key]["quantity"] += quantity
                grouped_charge_map[group_key]["total_amount"] += inv.total_amount
                event_ref = {
                    "id": str(inv.id),
                    "name": desc,
                    "date": charge_date,
                    "price": str(inv.total_amount),
                    "quantity": str(quantity),
                    "invoice_no": inv.invoice_no,
                    "payment_mode": invoice_payment_mode,
                    "paid_amount": "0.00",
                    "slip_number": "",
                }
                grouped_charge_map[group_key]["events"].append(event_ref)
                invoice_event_refs.append({
                    "group_key": group_key,
                    "event": event_ref,
                    "amount": inv.total_amount,
                })
                continue

            for idx, item in enumerate(items):
                desc = (item.description or "Service").strip() or "Service"
                quantity = item.quantity or Decimal("1")
                unit_price = item.unit_price if item.unit_price is not None else Decimal("0.00")
                line_total = item.line_total if item.line_total is not None else (unit_price * quantity)
                charge_date = (item.created_at or inv.created_at).isoformat()

                record_charges.append({
                    "id": f"{inv.id}:{idx + 1}",
                    "type": "charge",
                    "date": charge_date,
                    "description": desc,
                    "amount": str(line_total),
                    "invoice_no": inv.invoice_no,
                    "quantity": str(quantity),
                    "unit_price": str(unit_price),
                    "charge_times": [charge_date],
                    "payment_mode": invoice_payment_mode,
                })

                group_key = (desc or "").strip().lower()
                if group_key not in grouped_charge_map:
                    grouped_charge_map[group_key] = {
                        "id": f"grp-{str(inv.id)}-{idx + 1}",
                        "description": desc,
                        "quantity": Decimal("0.00"),
                        "total_amount": Decimal("0.00"),
                        "total_paid": Decimal("0.00"),
                        "events": [],
                    }
                grouped_charge_map[group_key]["quantity"] += quantity
                grouped_charge_map[group_key]["total_amount"] += line_total
                event_ref = {
                    "id": f"{inv.id}:{idx + 1}",
                    "name": desc,
                    "date": charge_date,
                    "price": str(line_total),
                    "quantity": str(quantity),
                    "invoice_no": inv.invoice_no,
                    "payment_mode": invoice_payment_mode,
                    "paid_amount": "0.00",
                    "slip_number": "",
                }
                grouped_charge_map[group_key]["events"].append(event_ref)
                invoice_event_refs.append({
                    "group_key": group_key,
                    "event": event_ref,
                    "amount": line_total,
                })

        pharmacy_invoices = PharmacyInvoice.objects.filter(
            ipd_admission=admission,
            status=PharmacyInvoice.Status.FINALIZED,
        ).order_by("-created_at")
        pharmacy_total = Decimal("0.00")
        pharmacy_paid = Decimal("0.00")
        pharmacy_payment_rows = []
        for pinv in pharmacy_invoices:
            grand_total = pinv.grand_total or Decimal("0.00")
            method = (pinv.payment_method or "cash").lower()
            if method == "credit":
                paid_amount = max(Decimal("0.00"), pinv.paid_amount or Decimal("0.00"))
                # Guard against accidental overpayment values.
                paid_amount = min(paid_amount, grand_total)
            else:
                paid_amount = grand_total
            pharmacy_total += grand_total
            pharmacy_paid += paid_amount
            record_charges.append(
                {
                    "id": f"pharmacy-{pinv.id}",
                    "type": "pharmacy_charge",
                    "date": pinv.created_at.isoformat(),
                    "description": f"Pharmacy Invoice ({(pinv.payment_method or 'cash').upper()})",
                    "amount": str(grand_total),
                    "invoice_no": pinv.invoice_no,
                }
            )
            if paid_amount > 0:
                pharmacy_payment_rows.append(
                    {
                        "id": f"pharmacy-paid-{pinv.id}",
                        "type": "pharmacy_payment",
                        "date": pinv.created_at.isoformat(),
                        "description": f"Pharmacy Paid - {pinv.payment_method.upper()}",
                        "amount": str(paid_amount),
                        "invoice_no": pinv.invoice_no,
                    }
                )
            
        # 2. Dynamic Room Rent
        room_rent = Decimal("0.00")
        bed = Bed.objects.select_related('room').filter(bed_code=admission.bed_code, hospital_id=admission.hospital_id).first()
        days = 1
        if admission.status in (IPDAdmission.Status.DISCHARGED, IPDAdmission.Status.CANCELLED) and admission.discharged_at:
            days = max(1, (admission.discharged_at.date() - admission.admission_date).days)
        else:
            days = max(1, (timezone.now().date() - admission.admission_date).days)
            
        if bed and bed.room and bed.room.daily_charge:
            room_rent = bed.room.daily_charge * days
            record_charges.append({
                "id": "room_rent",
                "type": "room_rent",
                "date": timezone.now().isoformat(),
                "description": f"Room Rent ({days} days @ ₹{bed.room.daily_charge})",
                "amount": str(room_rent),
                "invoice_no": "SYSTEM"
            })
            
        total_charges = invoices_total + room_rent + pharmacy_total
        
        # 3. Payments
        payments = PaymentTransaction.objects.filter(
            Q(invoice__ipd_admission=admission)
            | Q(
                invoice__ipd_admission__isnull=True,
                invoice__encounter_type=BillingInvoice.EncounterType.IPD,
                invoice__patient=admission.patient,
                invoice__invoice_date__gte=admission.admission_date,
                invoice__invoice_date__lte=stay_end_date,
            ),
            status=PaymentTransaction.Status.SUCCESS
        ).select_related("invoice").order_by("-created_at")
        
        record_payments = []
        total_paid = Decimal("0.00")
        for p in payments:
            total_paid += p.amount
            desc_prefix = "Advance" if "ADV" in p.invoice.invoice_no else "Payment"
            record_payments.append({
                "id": str(p.id),
                "type": "payment",
                "date": p.created_at.isoformat(),
                "description": f"{desc_prefix} - {p.payment_mode.upper()}",
                "amount": str(p.amount),
                "invoice_no": p.invoice.invoice_no
            })
            event_refs = invoice_to_event_refs.get(str(p.invoice_id), [])
            if event_refs:
                total_ref_amount = sum((ref["amount"] or Decimal("0.00")) for ref in event_refs) or Decimal("0.00")
                remaining = p.amount
                for idx, ref in enumerate(event_refs):
                    group_key = ref.get("group_key")
                    ev = ref.get("event")
                    if not group_key or group_key not in grouped_charge_map or not ev:
                        continue
                    if idx == len(event_refs) - 1 or total_ref_amount <= Decimal("0.00"):
                        allocation = remaining
                    else:
                        ratio = (ref["amount"] or Decimal("0.00")) / total_ref_amount if total_ref_amount > 0 else Decimal("0.00")
                        allocation = (p.amount * ratio).quantize(Decimal("0.01"))
                        remaining -= allocation
                    grouped_charge_map[group_key]["total_paid"] += allocation
                    existing = Decimal(str(ev.get("paid_amount", "0.00")))
                    ev["paid_amount"] = str(existing + allocation)
                    ev["payment_mode"] = p.payment_mode or ev.get("payment_mode") or "other"
                    ev["slip_number"] = getattr(p, "slip_number", "") or ev.get("slip_number") or ""
        # Include pharmacy payments in totals so statement math stays consistent.
        total_paid += pharmacy_paid
        record_payments.extend(pharmacy_payment_rows)
            
        balance_due = total_charges - total_paid

        return Response({
            "total_charges": str(total_charges),
            "total_paid": str(total_paid),
            "balance_due": str(balance_due),
            "charges": record_charges,
            "grouped_charges": [
                {
                    "id": row["id"],
                    "description": row["description"],
                    "quantity": str(row["quantity"]),
                    "total_amount": str(row["total_amount"]),
                    "total_paid": str(row["total_paid"]),
                    "events": sorted(row["events"], key=lambda e: e["date"]),
                }
                for row in grouped_charge_map.values()
            ],
            "payments": record_payments,
            "room_rent": str(room_rent),
            "days": days
        })

    @action(detail=True, methods=["post"], url_path="capture-advance")
    @transaction.atomic
    def capture_advance(self, request, pk=None):
        """Create an advance invoice and payment for this admission."""
        admission = self.get_object()
        amount_str = request.data.get("amount")
        mode = (request.data.get("payment_mode", "cash") or "cash").lower()
        ref = request.data.get("reference", "")

        if not amount_str:
            return Response({"error": "Amount is required"}, status=400)
        
        try:
            amount = Decimal(str(amount_str))
        except:
            return Response({"error": "Invalid amount format"}, status=400)

        if amount <= 0:
            return Response({"error": "Amount must be greater than zero"}, status=400)

        # 1. Generate Invoice No
        hospital = admission.hospital
        hospital_id = hospital.id
        year = timezone.now().year
        seq, _ = InvoiceNumberSequence.objects.select_for_update().get_or_create(hospital_id=hospital_id, year=year)
        seq.last_seq += 1
        seq.save(update_fields=["last_seq"])
        
        slug_part = (hospital.slug or hospital.name or "HOSP")[:5].upper()
        invoice_no = f"IPDADV-{slug_part}-{year}-{seq.last_seq:04d}"

        allowed_modes = {"cash", "upi", "other", "credit"}
        if mode not in allowed_modes:
            mode = "cash"
        is_credit = mode == "credit"

        # 2. Create Invoice
        invoice = BillingInvoice.objects.create(
            hospital_id=hospital_id,
            invoice_no=invoice_no,
            encounter_type=BillingInvoice.EncounterType.IPD,
            patient=admission.patient,
            ipd_admission=admission,
            status=BillingInvoice.Status.FINALIZED,
            subtotal_amount=amount,
            total_amount=amount,
            amount_paid=Decimal("0.00") if is_credit else amount,
            currency="INR",
            invoice_date=timezone.now().date()
        )
        
        InvoiceItem.objects.create(
            invoice=invoice,
            description="Advance Payment",
            quantity=Decimal("1"),
            unit_price=amount,
            line_total=amount
        )

        # 3. Create Payment (only for non-credit entries)
        payment = None
        if not is_credit:
            payment = PaymentTransaction.objects.create(
                hospital_id=hospital_id,
                invoice=invoice,
                payment_mode=mode,
                amount=amount,
                transaction_reference=ref,
                status=PaymentTransaction.Status.SUCCESS,
                collected_by=request.user,
                paid_at=timezone.now()
            )

        return Response({
            "success": True,
            "invoice_no": invoice.invoice_no,
            "is_credit": is_credit,
            "payment": PaymentTransactionSerializer(payment).data if payment else None
        })

    @action(detail=True, methods=["post"], url_path="add-charge")
    @transaction.atomic
    def add_charge(self, request, pk=None):
        """Add a service charge (e.g. Surgery, Procedure) to this admission."""
        admission = self.get_object()
        description = request.data.get("description")
        amount_str = request.data.get("amount")
        quantity_str = request.data.get("quantity")
        unit_price_str = request.data.get("unit_price")

        if not description or not amount_str:
            return Response({"error": "Description and amount are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount_str))
        except:
            return Response({"error": "Invalid amount format"}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return Response({"error": "Amount must be greater than 0"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            quantity = Decimal(str(quantity_str if quantity_str is not None else "1"))
        except Exception:
            return Response({"error": "Invalid quantity format"}, status=status.HTTP_400_BAD_REQUEST)
        if quantity <= 0:
            return Response({"error": "Quantity must be greater than 0"}, status=status.HTTP_400_BAD_REQUEST)

        if unit_price_str is not None and str(unit_price_str).strip() != "":
            try:
                unit_price = Decimal(str(unit_price_str))
            except Exception:
                return Response({"error": "Invalid unit price format"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            unit_price = (amount / quantity) if quantity else amount

        # 1. Generate Invoice No (Prefix IPDSRV)
        hospital = admission.hospital
        hospital_id = hospital.id
        year = timezone.now().year
        seq, _ = InvoiceNumberSequence.objects.select_for_update().get_or_create(hospital_id=hospital_id, year=year)
        seq.last_seq += 1
        seq.save(update_fields=["last_seq"])
        
        slug_part = (hospital.slug or hospital.name or "HOSP")[:5].upper()
        invoice_no = f"IPDSRV-{slug_part}-{year}-{seq.last_seq:04d}"

        # 2. Create Invoice
        payment_mode = request.data.get("payment_mode", "credit")
        amount_paid = amount if payment_mode in ["cash", "upi", "other"] else Decimal("0.00")

        invoice = BillingInvoice.objects.create(
            hospital_id=hospital_id,
            invoice_no=invoice_no,
            encounter_type=BillingInvoice.EncounterType.IPD,
            patient=admission.patient,
            ipd_admission=admission,
            status=BillingInvoice.Status.FINALIZED,
            subtotal_amount=amount,
            total_amount=amount,
            amount_paid=amount_paid,
            currency="INR",
            invoice_date=timezone.now().date()
        )
        
        InvoiceItem.objects.create(
            invoice=invoice,
            description=description,
            quantity=quantity,
            unit_price=unit_price,
            line_total=amount
        )

        payment_data = None
        if amount_paid > 0:
            payment = PaymentTransaction.objects.create(
                hospital_id=hospital_id,
                invoice=invoice,
                payment_mode=payment_mode,
                amount=amount,
                transaction_reference="",
                status=PaymentTransaction.Status.SUCCESS,
                collected_by=request.user,
                paid_at=timezone.now()
            )
            payment_data = PaymentTransactionSerializer(payment).data

        return Response({
            "success": True,
            "invoice_no": invoice.invoice_no,
            "description": description,
            "amount": amount,
            "quantity": str(quantity),
            "unit_price": str(unit_price),
            "payment": payment_data
        })

    @action(detail=True, methods=["patch"], url_path="update-charge")
    @transaction.atomic
    def update_charge(self, request, pk=None):
        """Update the amount and/or quantity of an existing service charge."""
        admission = self.get_object()
        invoice_id = request.data.get("invoice_id")
        amount_str = request.data.get("amount")
        quantity_str = request.data.get("quantity")
        unit_price_str = request.data.get("unit_price")

        if not invoice_id:
            return Response({"error": "Invoice ID is required"}, status=400)

        # 1. Find the invoice — must belong to this admission
        if invoice_id == "room_rent":
            return Response({"error": "Room Rent is system-calculated and cannot be edited directly"}, status=400)

        try:
            invoice = BillingInvoice.objects.filter(
                id=invoice_id, ipd_admission=admission
            ).first()
        except (ValueError, TypeError):
            return Response({"error": "Invalid Invoice ID format"}, status=400)

        if not invoice:
            return Response({"error": "Invoice not found or does not belong to this admission"}, status=404)

        if invoice.status == BillingInvoice.Status.CANCELLED:
            return Response({"error": "Cannot edit a cancelled invoice"}, status=400)

        # 2. Update line items
        # Typically these service charges have only one item
        item = invoice.items.first()
        if item:
            current_quantity = item.quantity or Decimal("1")
            current_unit_price = item.unit_price if item.unit_price is not None else (
                (invoice.total_amount / current_quantity) if current_quantity else invoice.total_amount
            )

            quantity = current_quantity
            unit_price = current_unit_price

            if quantity_str is not None:
                try:
                    quantity = Decimal(str(quantity_str))
                except Exception:
                    return Response({"error": "Invalid quantity format"}, status=400)
                if quantity <= 0:
                    return Response({"error": "Quantity must be greater than 0"}, status=400)

            if amount_str is not None:
                try:
                    amount = Decimal(str(amount_str))
                except Exception:
                    return Response({"error": "Invalid amount format"}, status=400)
                unit_price = (amount / quantity) if quantity else amount
                new_total = amount
            elif unit_price_str is not None:
                try:
                    unit_price = Decimal(str(unit_price_str))
                except Exception:
                    return Response({"error": "Invalid unit price format"}, status=400)
                new_total = unit_price * quantity
            elif quantity_str is not None:
                new_total = unit_price * quantity
            else:
                return Response({"error": "Provide amount, quantity, or unit_price to update"}, status=400)

            item.quantity = quantity
            item.unit_price = unit_price
            item.line_total = new_total
            item.save(update_fields=["quantity", "unit_price", "line_total"])
        else:
            return Response({"error": "No invoice item found to update"}, status=400)

        # 3. Update invoice totals directly
        # We bypass recalc_totals() here because that method incorrectly zeroes out 
        # negative totals, but our IPD system uses negative amounts for discounts.
        invoice.subtotal_amount = item.line_total
        invoice.total_amount = item.line_total
        invoice.save(update_fields=["subtotal_amount", "total_amount"])

        return Response({
            "success": True,
            "invoice_no": invoice.invoice_no,
            "quantity": str(item.quantity),
            "unit_price": str(item.unit_price),
            "new_total": str(invoice.total_amount)
        })
