from decimal import Decimal

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from apps.billing.models import BillingInvoice
from apps.shared.models import Hospital, SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel


class PaymentSlipSequence(TimeStampedModel):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="payment_slip_sequences")
    year = models.PositiveIntegerField()
    last_seq = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [("hospital", "year")]

    def __str__(self) -> str:
        return f"{self.hospital_id}-{self.year}-{self.last_seq}"


class PaymentTransaction(SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel):
    class PaymentMode(models.TextChoices):
        CASH = "cash"
        CARD = "card"
        UPI = "upi"
        BANK_TRANSFER = "bank_transfer"
        OTHER = "other"

    class Status(models.TextChoices):
        SUCCESS = "success"
        PENDING = "pending"
        FAILED = "failed"
        CANCELLED = "cancelled"

    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="payments")
    invoice = models.ForeignKey(BillingInvoice, on_delete=models.PROTECT, related_name="payments")

    payment_mode = models.CharField(max_length=30, choices=PaymentMode.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    transaction_reference = models.CharField(max_length=120, blank=True, default="")
    receipt_no = models.CharField(max_length=60, blank=True, default="")
    slip_number = models.CharField(max_length=80, unique=True, db_index=True, blank=True, default="")

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUCCESS, db_index=True)
    paid_at = models.DateTimeField(default=timezone.now, db_index=True)

    collected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="collected_payments",
    )

    @staticmethod
    def _build_slip_number(hospital, year: int, seq: int) -> str:
        slug = (getattr(hospital, "slug", "") or getattr(hospital, "name", "HOSP") or "HOSP")
        slug_part = "".join(ch for ch in str(slug).upper() if ch.isalnum())[:5] or "HOSP"
        return f"PSL-{slug_part}-{year}-{seq:06d}"

    def _generate_slip_number(self) -> str:
        if not self.hospital_id:
            return ""
        now = self.paid_at or timezone.now()
        year = now.year
        with transaction.atomic():
            seq_obj, _ = PaymentSlipSequence.objects.select_for_update().get_or_create(
                hospital_id=self.hospital_id,
                year=year,
            )
            seq_obj.last_seq += 1
            seq_obj.save(update_fields=["last_seq", "updated_at"])
            hospital = getattr(self, "hospital", None) or Hospital.objects.only("id", "slug", "name").get(id=self.hospital_id)
            return self._build_slip_number(hospital, year, seq_obj.last_seq)

    def save(self, *args, **kwargs):
        if not self.slip_number:
            self.slip_number = self._generate_slip_number()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.invoice.invoice_no} - {self.amount} ({self.status})"


class RefundLog(TimeStampedModel, UUIDPrimaryKeyModel):
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="refunds")
    invoice = models.ForeignKey(BillingInvoice, on_delete=models.PROTECT, related_name="refunds")
    payment = models.ForeignKey(PaymentTransaction, on_delete=models.PROTECT, null=True, blank=True, related_name="refunds")

    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    reason = models.CharField(max_length=500, blank=True, default="")
    refunded_at = models.DateTimeField(default=timezone.now, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_refunds",
    )

    def __str__(self) -> str:
        return f"Refund {self.invoice.invoice_no} - {self.amount}"


class CashHandover(TimeStampedModel, UUIDPrimaryKeyModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="handovers")
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="handovers_sent"
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="handovers_received"
    )

    # System calculated totals at the time of creation
    system_cash_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    system_upi_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    system_other_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # Declared by the person handing over
    declared_cash_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    def __str__(self) -> str:
        return f"Handover from {self.from_user.username} to {self.to_user.username} ({self.status})"


class PaymentQuickService(TimeStampedModel, UUIDPrimaryKeyModel):
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="payment_quick_services")
    label = models.CharField(max_length=120)
    category = models.CharField(max_length=80, default="Custom", db_index=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["hospital", "is_active", "category", "sort_order"]),
            models.Index(fields=["hospital", "label"]),
        ]
        ordering = ["sort_order", "created_at"]

    def __str__(self) -> str:
        return f"{self.label} ({self.price})"


class PaymentQuickCategory(TimeStampedModel, UUIDPrimaryKeyModel):
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="payment_quick_categories")
    name = models.CharField(max_length=80)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["hospital", "is_active", "sort_order"]),
            models.Index(fields=["hospital", "name"]),
        ]
        ordering = ["sort_order", "created_at"]

    def __str__(self) -> str:
        return self.name

