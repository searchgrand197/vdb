from decimal import Decimal
from django.db.models import Q, Sum
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.discharge.models import DischargeSummary
from apps.discharge.serializers import DischargeSummarySerializer
from apps.ipd.models import IPDAdmission
from apps.billing.models import BillingInvoice
from apps.payments.models import PaymentTransaction
from apps.pharmacy.models import PharmacyInvoice
from apps.shared.response import success_response


class DischargeSummaryViewSet(viewsets.ModelViewSet):
    queryset = DischargeSummary.objects.all().select_related("admission", "admission__patient")
    serializer_class = DischargeSummarySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.is_superuser:
            filtered_qs = qs
        else:
            filtered_qs = qs.filter(hospital_id=self.request.user.hospital_id)

        admission_id = self.request.query_params.get("admission_id")
        if admission_id:
            filtered_qs = filtered_qs.filter(admission_id=admission_id)
        return filtered_qs

    def _finalize_admission(self, admission, hospital_id):
        # 1. Finalize Room Charges before closing
        from django.utils import timezone
        from apps.beds.models import Bed
        from apps.billing.models import BillingInvoice, InvoiceItem, InvoiceNumberSequence
        
        # Calculate stay exactly as in billing_summary - nights based calculation
        end_date = timezone.now().date()
        delta = end_date - admission.admission_date
        stay_days = max(1, delta.days)
        
        if admission.bed_code:
            bed = Bed.objects.filter(bed_code=admission.bed_code, hospital_id=hospital_id).select_related("room").first()
            if bed and bed.room:
                daily_rate = bed.room.daily_charge
                total_room_amount = stay_days * daily_rate
                
                if total_room_amount > 0:
                    # Generate Room Invoice No
                    year = end_date.year
                    seq, _ = InvoiceNumberSequence.objects.select_for_update().get_or_create(hospital_id=hospital_id, year=year)
                    seq.last_seq += 1
                    seq.save(update_fields=["last_seq"])
                    
                    slug_part = (admission.hospital.slug or admission.hospital.name or "HOSP")[:5].upper()
                    room_inv_no = f"IPDROOM-{slug_part}-{year}-{seq.last_seq:04d}"
                    
                    # Create the final room invoice
                    room_invoice = BillingInvoice.objects.create(
                        hospital_id=hospital_id,
                        invoice_no=room_inv_no,
                        encounter_type=BillingInvoice.EncounterType.IPD,
                        patient=admission.patient,
                        ipd_admission=admission,
                        status=BillingInvoice.Status.FINALIZED,
                        subtotal_amount=total_room_amount,
                        total_amount=total_room_amount,
                        amount_paid=Decimal("0.00"),
                        currency="INR",
                        invoice_date=end_date
                    )
                    InvoiceItem.objects.create(
                        invoice=room_invoice,
                        description=f"Room Charges: {admission.bed_code} ({stay_days} days @ ₹{daily_rate})",
                        quantity=Decimal(str(stay_days)),
                        unit_price=daily_rate,
                        line_total=total_room_amount
                    )

        # 2. Mark the admission as discharged
        if admission.status != IPDAdmission.Status.DISCHARGED:
            admission.status = IPDAdmission.Status.DISCHARGED
            admission.discharged_at = timezone.now()
            admission.save(update_fields=["status", "discharged_at"])

        # 3. Release occupied bed immediately after discharge (vacant/available).
        if admission.bed_code:
            Bed.objects.filter(
                bed_code=admission.bed_code,
                hospital_id=hospital_id,
            ).update(status=Bed.Status.AVAILABLE)

    def create(self, request, *args, **kwargs):
        admission_id = request.data.get("admission")
        if not admission_id:
            return Response({"admission": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        try:
            admission = IPDAdmission.objects.select_related("hospital").get(pk=admission_id)
        except IPDAdmission.DoesNotExist:
            return Response({"admission": ["Invalid admission id."]}, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.is_superuser and admission.hospital_id != request.user.hospital_id:
            return Response({"detail": "Not permitted for this admission."}, status=status.HTTP_403_FORBIDDEN)

        hospital_id = admission.hospital_id

        summary, created = DischargeSummary.objects.get_or_create(
            admission=admission,
            defaults={"hospital_id": hospital_id},
        )

        for field in [
            "summary_notes",
            "treatment_given",
            "condition_at_discharge",
            "medications_on_discharge",
            "follow_up_advice",
            "reason_for_admission",
            "diagnosis",
            "allergies",
            "procedure_surgery",
            "medical_history",
            "physical_examination",
            "investigations",
            "course_in_hospital",
            "diet_advice",
            "activity_advice",
            "warning_signs",
        ]:
            if field in request.data:
                setattr(summary, field, request.data.get(field) or "")

        is_finalize_payload = all(
            key in request.data for key in ["total_billed", "total_paid", "outstanding_balance"]
        )
        if is_finalize_payload:
            try:
                summary.total_billed = Decimal(str(request.data.get("total_billed", summary.total_billed)))
                summary.total_paid = Decimal(str(request.data.get("total_paid", summary.total_paid)))
                summary.outstanding_balance = Decimal(str(request.data.get("outstanding_balance", summary.outstanding_balance)))
            except Exception:
                return Response(
                    {"detail": "Invalid financial values in finalize payload."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        summary.hospital_id = hospital_id
        summary.save()

        if is_finalize_payload and admission.status != IPDAdmission.Status.DISCHARGED:
            self._finalize_admission(admission, hospital_id)

        out = self.get_serializer(summary)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(out.data, status=status_code)

    @action(detail=False, methods=["get"], url_path="billing-summary")
    def billing_summary(self, request):
        """Calculate total billed, paid, and outstanding for an admission including room charges."""
        admission_id = request.query_params.get("admission_id")
        if not admission_id:
            return Response({"error": "admission_id query param required"}, status=400)
            
        try:
            from django.utils import timezone
            from apps.beds.models import Bed
            admission = IPDAdmission.objects.select_related("patient", "hospital").get(pk=admission_id)
        except IPDAdmission.DoesNotExist:
            return Response({"error": "Admission not found"}, status=404)

        # 1. Total Services (Surgery, Pharmacy, etc.)
        # IMPORTANT: We calculate this from InvoiceItems to precisely exclude existing room rent items
        # and we must exclude Advance Invoices which are NOT charges.
        from apps.billing.models import InvoiceItem
        total_services = InvoiceItem.objects.filter(
            invoice__ipd_admission=admission,
            invoice__status=BillingInvoice.Status.FINALIZED
        ).exclude(
            # Exclude paid advances only; include credit advances as due services.
            Q(invoice__invoice_no__startswith="IPDADV-") & Q(invoice__amount_paid__gt=0)
        ).exclude(
            invoice__invoice_no__startswith="IPDROOM-" # Exclude finalized Room bills
        ).exclude(
            description__icontains="Room Rent" # Double-check exclusion by description
        ).aggregate(total=Sum("line_total"))["total"] or Decimal("0.00")

        pharmacy_invoices = PharmacyInvoice.objects.filter(
            ipd_admission=admission,
            status=PharmacyInvoice.Status.FINALIZED,
        )
        pharmacy_services_total = (
            pharmacy_invoices.aggregate(total=Sum("grand_total"))["total"] or Decimal("0.00")
        )
        total_services += pharmacy_services_total

        # 2. Dynamic Room Charges
        room_total = Decimal("0.00")
        stay_days = 0
        daily_rate = Decimal("0.00")
        
        # Determine stay duration (minimum 1 day) - Nights calculation matches ledger
        end_date = admission.discharged_at.date() if admission.discharged_at else timezone.now().date()
        delta = end_date - admission.admission_date
        stay_days = max(1, delta.days)

        # Get room rate
        if admission.bed_code:
            bed = Bed.objects.filter(bed_code=admission.bed_code, hospital=admission.hospital).select_related("room").first()
            if bed and bed.room:
                daily_rate = bed.room.daily_charge
                room_total = stay_days * daily_rate

        # 3. Total Paid: Sum of all successful payment transactions (advances and payments)
        total_paid = PaymentTransaction.objects.filter(
            invoice__ipd_admission=admission,
            status=PaymentTransaction.Status.SUCCESS
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

        pharmacy_paid = Decimal("0.00")
        for pinv in pharmacy_invoices:
            grand_total = pinv.grand_total or Decimal("0.00")
            method = (pinv.payment_method or "cash").lower()
            if method == "credit":
                paid_amount = max(Decimal("0.00"), pinv.paid_amount or Decimal("0.00"))
                paid_amount = min(paid_amount, grand_total)
            else:
                paid_amount = grand_total
            pharmacy_paid += paid_amount
        total_paid += pharmacy_paid

        total_billed = total_services + room_total
        outstanding = total_billed - total_paid

        return Response({
            "admission_id": admission_id,
            "patient_name": f"{admission.patient.first_name} {admission.patient.last_name}",
            "admission_date": admission.admission_date,
            "stay_days": stay_days,
            "daily_rate": daily_rate,
            "room_total": room_total,
            "total_services": total_services,
            "total_billed": total_billed,
            "total_paid": total_paid,
            "outstanding": outstanding
        })
