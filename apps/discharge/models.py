from django.db import models
from apps.ipd.models import IPDAdmission
from apps.shared.models import Hospital, SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel


class DischargeSummary(SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel):
    admission = models.OneToOneField(IPDAdmission, on_delete=models.CASCADE, related_name="discharge_summary")
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="discharge_summaries")

    summary_notes = models.TextField(blank=True, default="")
    treatment_given = models.TextField(blank=True, default="")
    condition_at_discharge = models.TextField(blank=True, default="")
    medications_on_discharge = models.TextField(blank=True, default="")
    follow_up_advice = models.TextField(blank=True, default="")
    
    # New Medanta-style fields
    reason_for_admission = models.TextField(blank=True, default="")
    diagnosis = models.TextField(blank=True, default="")
    allergies = models.TextField(blank=True, default="")
    procedure_surgery = models.TextField(blank=True, default="")
    medical_history = models.TextField(blank=True, default="")
    physical_examination = models.TextField(blank=True, default="")
    investigations = models.TextField(blank=True, default="")
    course_in_hospital = models.TextField(blank=True, default="")
    diet_advice = models.TextField(blank=True, default="")
    activity_advice = models.TextField(blank=True, default="")
    warning_signs = models.TextField(blank=True, default="")
    
    # Financial capture at the moment of discharge (snapshot)
    total_billed = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    outstanding_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    def __str__(self) -> str:
        return f"Summary for {self.admission.patient.uhid}"
