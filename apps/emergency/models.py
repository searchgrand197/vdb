from django.db import models
from django.utils import timezone

from apps.shared.models import Hospital, TimeStampedModel, UUIDPrimaryKeyModel


class EmergencyCase(TimeStampedModel, UUIDPrimaryKeyModel):
    TRIAGE_CHOICES = (
        ("red", "Red"),
        ("yellow", "Yellow"),
        ("green", "Green"),
    )
    STATUS_CHOICES = (
        ("waiting", "Waiting"),
        ("attended", "Attended"),
        ("admitted", "Admitted"),
    )

    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="emergency_cases")
    patient_name = models.CharField(max_length=200)
    contact = models.CharField(max_length=40, blank=True, default="")
    complaint = models.TextField(blank=True, default="")
    triage = models.CharField(max_length=10, choices=TRIAGE_CHOICES, default="yellow")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="waiting", db_index=True)
    arrived_at = models.DateTimeField(default=timezone.now, db_index=True)
    attended_at = models.DateTimeField(null=True, blank=True)
    admitted_at = models.DateTimeField(null=True, blank=True)
    admitted_bed = models.CharField(max_length=60, blank=True, default="")
    charge_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    charge_invoice_no = models.CharField(max_length=80, blank=True, default="")

    class Meta:
        ordering = ("-arrived_at", "-created_at")
        indexes = [
            models.Index(fields=["hospital", "status"]),
            models.Index(fields=["hospital", "triage"]),
            models.Index(fields=["hospital", "arrived_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.patient_name} ({self.status})"
