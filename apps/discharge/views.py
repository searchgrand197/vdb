from decimal import Decimal

from django.db.models import Q, Sum
from django.utils.dateparse import parse_date, parse_datetime, parse_time
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.discharge.models import DischargeInvestigation, DischargeMedication, DischargeSummary, DischargeSurgery
from apps.discharge.serializers import DischargeSummarySerializer
from apps.ipd.models import IPDAdmission
from apps.billing.models import BillingInvoice
from apps.payments.models import PaymentTransaction
from apps.pharmacy.models import PharmacyInvoice


def _parse_bool(val):
    if val is True or val is False:
        return val
    if val in (None, ""):
        return False
    s = str(val).strip().lower()
    return s in ("1", "true", "yes", "on")


def _parse_optional_date(val):
    if val in (None, ""):
        return None
    if hasattr(val, "isoformat") and not isinstance(val, str):
        return val
    return parse_date(str(val))


def _parse_optional_time(val):
    if val in (None, ""):
        return None
    if hasattr(val, "isoformat") and not isinstance(val, str):
        return val
    return parse_time(str(val))


def _parse_optional_datetime(val):
    if val in (None, ""):
        return None
    if hasattr(val, "isoformat") and not isinstance(val, str):
        return val
    return parse_datetime(str(val))


def _doctor_display_name(user):
    if not user:
        return ""
    fn = getattr(user, "first_name", "") or ""
    ln = getattr(user, "last_name", "") or ""
    name = f"{fn} {ln}".strip()
    if name:
        return name
    return getattr(user, "email", "") or str(user.pk)


class DischargeSummaryViewSet(viewsets.ModelViewSet):
    queryset = (
        DischargeSummary.objects.all()
        .select_related("admission", "admission__patient", "admission__assigned_doctor")
        .prefetch_related("medication_rows", "investigation_rows", "surgery_rows")
    )
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
            filtered_qs = filtered_qs.filter(admission_id=admission_id).order_by(
                "-updated_at", "-created_at"
            )
        return filtered_qs

    def _finalize_admission(self, admission, hospital_id, summary=None):
        # 1. Finalize Room Charges before closing (skip for death/abscond discharge types)
        from django.utils import timezone

        from apps.beds.models import Bed
        from apps.billing.models import BillingInvoice, InvoiceItem, InvoiceNumberSequence

        skip_room_invoice = summary and summary.discharge_type in (
            DischargeSummary.DischargeType.DEATH,
            DischargeSummary.DischargeType.ABSCONDED,
        )

        end_date = timezone.now().date()
        delta = end_date - admission.admission_date
        stay_days = max(1, delta.days)

        if not skip_room_invoice and admission.bed_code:
            bed = Bed.objects.filter(bed_code=admission.bed_code, hospital_id=hospital_id).select_related("room").first()
            if bed and bed.room:
                daily_rate = bed.room.daily_charge
                total_room_amount = stay_days * daily_rate

                if total_room_amount > 0:
                    year = end_date.year
                    seq, _ = InvoiceNumberSequence.objects.select_for_update().get_or_create(
                        hospital_id=hospital_id, year=year
                    )
                    seq.last_seq += 1
                    seq.save(update_fields=["last_seq"])

                    slug_part = (admission.hospital.slug or admission.hospital.name or "HOSP")[:5].upper()
                    room_inv_no = f"IPDROOM-{slug_part}-{year}-{seq.last_seq:04d}"

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
                        invoice_date=end_date,
                    )
                    InvoiceItem.objects.create(
                        invoice=room_invoice,
                        description=f"Room Charges: {admission.bed_code} ({stay_days} days @ ₹{daily_rate})",
                        quantity=Decimal(str(stay_days)),
                        unit_price=daily_rate,
                        line_total=total_room_amount,
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
            admission = IPDAdmission.objects.select_related(
                "hospital", "patient", "assigned_doctor"
            ).get(pk=admission_id)
        except IPDAdmission.DoesNotExist:
            return Response({"admission": ["Invalid admission id."]}, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.is_superuser and admission.hospital_id != request.user.hospital_id:
            return Response({"detail": "Not permitted for this admission."}, status=status.HTTP_403_FORBIDDEN)

        hospital_id = admission.hospital_id

        summary, created = DischargeSummary.objects.get_or_create(
            admission=admission,
            defaults={"hospital_id": hospital_id},
        )

        TEXT_FIELDS = [
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
            "chief_complaints",
            "co_morbidities",
            "family_history",
            "personal_history",
            "complications_during_stay",
            "blood_transfusion_details",
            "implants_used",
            "indwelling_devices_on_discharge",
            "vaccination_given",
            "wound_care_instructions",
            "operative_findings",
            "intra_op_complications",
            "referral_reason",
            "cause_of_death",
            "surgeon_name",
            "assistant_name",
            "anaesthetist_name",
            "anaesthesia_type",
            "referred_to_facility",
            "treating_consultant",
            "consultant_registration_no",
            "rmo_signed_by",
            "follow_up_doctor",
            "follow_up_department",
            "notified_to",
            "abha_id",
            "insurance_provider",
            "tpa_name",
            "policy_number",
            "claim_number",
            "attendant_counselled_by",
        ]

        CHOICE_FIELDS = ["discharge_type", "discharge_status", "mode_of_admission"]

        for field in TEXT_FIELDS:
            if field in request.data:
                setattr(summary, field, request.data.get(field) or "")

        for field in CHOICE_FIELDS:
            if field not in request.data:
                continue
            val = request.data.get(field)
            if val is None or (isinstance(val, str) and not val.strip()):
                continue
            setattr(summary, field, str(val).strip())

        if "vitals_at_discharge" in request.data:
            v = request.data.get("vitals_at_discharge")
            summary.vitals_at_discharge = v if isinstance(v, dict) else {}

        if "autopsy_required" in request.data:
            summary.autopsy_required = _parse_bool(request.data.get("autopsy_required"))

        if "patient_education_given" in request.data:
            summary.patient_education_given = _parse_bool(request.data.get("patient_education_given"))

        for fname in ("surgery_date", "stitch_removal_date", "next_follow_up_date", "discharge_date"):
            if fname in request.data:
                setattr(summary, fname, _parse_optional_date(request.data.get(fname)))

        if "discharge_time" in request.data:
            summary.discharge_time = _parse_optional_time(request.data.get("discharge_time"))

        if "time_of_death" in request.data:
            summary.time_of_death = _parse_optional_datetime(request.data.get("time_of_death"))

        if not (summary.treating_consultant or "").strip() and admission.assigned_doctor_id:
            summary.treating_consultant = _doctor_display_name(admission.assigned_doctor)

        if not (summary.mode_of_admission or "").strip():
            summary.mode_of_admission = (
                DischargeSummary.ModeOfAdmission.OPD
                if admission.opd_visit_id
                else DischargeSummary.ModeOfAdmission.EMERGENCY
            )

        is_finalize_payload = all(
            key in request.data for key in ["total_billed", "total_paid", "outstanding_balance"]
        )

        if is_finalize_payload:
            from django.utils import timezone as dj_tz

            now = dj_tz.now()
            if summary.discharge_date is None:
                summary.discharge_date = now.date()
            if summary.discharge_time is None:
                summary.discharge_time = now.time()

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

        if "medication_rows" in request.data:
            summary.medication_rows.all().delete()
            rows = request.data.get("medication_rows") or []
            if isinstance(rows, list):
                for i, row in enumerate(rows):
                    if not isinstance(row, dict):
                        continue
                    drug_name = (row.get("drug_name") or "").strip()
                    if not drug_name:
                        continue
                    rx_m = row.get("rx_meta")
                    if not isinstance(rx_m, dict):
                        rx_m = {}
                    DischargeMedication.objects.create(
                        summary=summary,
                        drug_name=drug_name[:200],
                        dose=(row.get("dose") or "")[:80],
                        route=(row.get("route") or "")[:40],
                        frequency=(row.get("frequency") or "")[:80],
                        duration=(row.get("duration") or "")[:80],
                        instructions=(row.get("instructions") or "")[:200],
                        sort_order=i,
                        rx_meta=rx_m,
                    )

        if "investigation_rows" in request.data:
            summary.investigation_rows.all().delete()
            rows = request.data.get("investigation_rows") or []
            if isinstance(rows, list):
                for i, row in enumerate(rows):
                    if not isinstance(row, dict):
                        continue
                    test_name = (row.get("test_name") or "").strip()
                    if not test_name:
                        continue
                    cat = (row.get("category") or DischargeInvestigation.Category.LAB).strip().lower()
                    if cat not in ("lab", "imaging"):
                        cat = DischargeInvestigation.Category.LAB
                    DischargeInvestigation.objects.create(
                        summary=summary,
                        category=cat,
                        test_name=test_name[:200],
                        value=(row.get("value") or "")[:120],
                        reference_range=(row.get("reference_range") or "")[:120],
                        test_date=_parse_optional_date(row.get("test_date")),
                        sort_order=i,
                    )

        if "surgery_rows" in request.data:
            summary.surgery_rows.all().delete()
            rows = request.data.get("surgery_rows") or []
            if isinstance(rows, list):
                for i, row in enumerate(rows):
                    if not isinstance(row, dict):
                        continue
                    procedure_name = (
                        row.get("procedure_name")
                        or row.get("procedure_surgery")
                        or row.get("name")
                        or ""
                    ).strip()
                    if not procedure_name:
                        continue
                    DischargeSurgery.objects.create(
                        summary=summary,
                        surgery_date=_parse_optional_date(row.get("surgery_date")),
                        procedure_name=procedure_name[:300],
                        surgeon_name=(row.get("surgeon_name") or "")[:200],
                        assistant_name=(row.get("assistant_name") or "")[:200],
                        anaesthetist_name=(row.get("anaesthetist_name") or "")[:200],
                        anaesthesia_type=(row.get("anaesthesia_type") or "")[:120],
                        operative_findings=(row.get("operative_findings") or ""),
                        intra_op_complications=(row.get("intra_op_complications") or ""),
                        sort_order=i,
                    )

                first_row = next(
                    (
                        r
                        for r in rows
                        if isinstance(r, dict)
                        and (
                            (r.get("procedure_name") or "").strip()
                            or (r.get("procedure_surgery") or "").strip()
                        )
                    ),
                    None,
                )
                if first_row:
                    summary.procedure_surgery = (
                        (first_row.get("procedure_name") or first_row.get("procedure_surgery") or "").strip()
                    )
                    summary.surgery_date = _parse_optional_date(first_row.get("surgery_date"))
                    summary.surgeon_name = (first_row.get("surgeon_name") or "")[:200]
                    summary.assistant_name = (first_row.get("assistant_name") or "")[:200]
                    summary.anaesthetist_name = (first_row.get("anaesthetist_name") or "")[:200]
                    summary.anaesthesia_type = (first_row.get("anaesthesia_type") or "")[:120]
                    summary.operative_findings = first_row.get("operative_findings") or ""
                    summary.intra_op_complications = first_row.get("intra_op_complications") or ""
                    summary.save(
                        update_fields=[
                            "procedure_surgery",
                            "surgery_date",
                            "surgeon_name",
                            "assistant_name",
                            "anaesthetist_name",
                            "anaesthesia_type",
                            "operative_findings",
                            "intra_op_complications",
                            "updated_at",
                        ]
                    )

        if is_finalize_payload and admission.status != IPDAdmission.Status.DISCHARGED:
            self._finalize_admission(admission, hospital_id, summary=summary)

        summary = (
            DischargeSummary.objects.select_related(
                "admission", "admission__patient", "admission__assigned_doctor"
            )
            .prefetch_related("medication_rows", "investigation_rows", "surgery_rows")
            .get(pk=summary.pk)
        )
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

        # Get room rate (respect per-day or total ledger overrides when set)
        if admission.room_rent_daily_charge_override is not None:
            room_total = admission.room_rent_daily_charge_override * Decimal(stay_days)
            if admission.bed_code:
                bed = Bed.objects.filter(bed_code=admission.bed_code, hospital=admission.hospital).select_related("room").first()
                if bed and bed.room:
                    daily_rate = admission.room_rent_daily_charge_override
        elif admission.room_rent_override is not None:
            room_total = admission.room_rent_override
            if admission.bed_code:
                bed = Bed.objects.filter(bed_code=admission.bed_code, hospital=admission.hospital).select_related("room").first()
                if bed and bed.room:
                    daily_rate = bed.room.daily_charge
        elif admission.bed_code:
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
