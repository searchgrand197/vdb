from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Sum
from django.utils import timezone

from apps.ipd.models import IPDAdmission
from apps.opd.models import OPDVisit
from apps.patients.models import Patient
from apps.shared.models import Hospital, SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel


class CollectionAttribution(models.TextChoices):
    DOCTOR = "doctor", "Doctor"
    HOSPITAL_SELF = "hospital_self", "Self (Hospital)"


class InvoiceNumberSequence(TimeStampedModel):
    """
    Invoice number sequence per hospital per year.
    """

    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="invoice_sequences")
    year = models.PositiveIntegerField()
    last_seq = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [("hospital", "year")]
        indexes = [models.Index(fields=["hospital", "year"])]


class BillingInvoice(SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel):
    class Status(models.TextChoices):
        DRAFT = "draft"
        FINALIZED = "finalized"
        CANCELLED = "cancelled"
        REFUNDED = "refunded"

    class EncounterType(models.TextChoices):
        OPD = "opd"
        IPD = "ipd"
        LAB = "lab"
        PHARMACY = "pharmacy"
        PACKAGE = "package"

    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="invoices")
    invoice_no = models.CharField(max_length=60)

    encounter_type = models.CharField(max_length=20, choices=EncounterType.choices, default=EncounterType.OPD)

    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="invoices")
    opd_visit = models.ForeignKey(OPDVisit, null=True, blank=True, on_delete=models.SET_NULL, related_name="invoices")
    ipd_admission = models.ForeignKey(
        IPDAdmission, null=True, blank=True, on_delete=models.SET_NULL, related_name="invoices"
    )

    invoice_date = models.DateField(default=timezone.now)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)

    currency = models.CharField(max_length=10, default="INR")
    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    cancelled_reason = models.CharField(max_length=500, blank=True, default="")
    cancelled_at = models.DateTimeField(null=True, blank=True)

    attribution_type = models.CharField(
        max_length=20,
        choices=CollectionAttribution.choices,
        default=CollectionAttribution.HOSPITAL_SELF,
        db_index=True,
    )
    attributed_doctor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attributed_invoices",
    )

    class Meta:
        unique_together = [("hospital", "invoice_no")]
        indexes = [models.Index(fields=["hospital", "invoice_date"]), models.Index(fields=["hospital", "status"])]

    def __str__(self) -> str:
        return self.invoice_no

    def recalc_totals(self):
        items_total = self.items.aggregate(t=Sum("line_total"))["t"] or Decimal("0.00")
        self.subtotal_amount = items_total
        taxable = self.subtotal_amount - self.discount_amount
        if taxable < 0:
            taxable = Decimal("0.00")
        self.tax_amount = (taxable * (self.tax_rate / Decimal("100.0")))
        self.total_amount = (taxable + self.tax_amount)


class InvoiceItem(TimeStampedModel, UUIDPrimaryKeyModel):
    invoice = models.ForeignKey(BillingInvoice, on_delete=models.CASCADE, related_name="items")
    description = models.CharField(max_length=300)
    category = models.CharField(max_length=120, default="", blank=True)
    subcategory = models.CharField(max_length=120, default="", blank=True)

    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1.00"))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        indexes = [models.Index(fields=["invoice", "description"])]

    def __str__(self) -> str:
        return self.description


class DailyClosingSummary(TimeStampedModel, UUIDPrimaryKeyModel):
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="daily_closings")
    closing_date = models.DateField()

    total_collected = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_invoiced = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_outstanding = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        unique_together = [("hospital", "closing_date")]

