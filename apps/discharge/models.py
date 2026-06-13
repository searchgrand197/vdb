from django.conf import settings
from django.db import models

from apps.ipd.models import IPDAdmission
from apps.shared.models import Hospital, SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel


class DischargeSummary(SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel):
    class DischargeType(models.TextChoices):
        ROUTINE = "routine", "Routine"
        LAMA = "lama", "LAMA"
        DAMA = "dama", "DAMA"
        REFERRED = "referred", "Referred"
        TRANSFERRED = "transferred", "Transferred"
        DEATH = "death", "Death"
        ABSCONDED = "absconded", "Absconded"

    class DischargeStatus(models.TextChoices):
        CURED = "cured", "Cured"
        IMPROVED = "improved", "Improved"
        UNCHANGED = "unchanged", "Unchanged"
        WORSENED = "worsened", "Worsened"
        DECEASED = "deceased", "Deceased"

    class ModeOfAdmission(models.TextChoices):
        EMERGENCY = "emergency", "Emergency"
        OPD = "opd", "OPD"
        REFERRAL = "referral", "Referral"

    admission = models.OneToOneField(IPDAdmission, on_delete=models.CASCADE, related_name="discharge_summary")
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="discharge_summaries")

    summary_notes = models.TextField(blank=True, default="")
    treatment_given = models.TextField(blank=True, default="")
    condition_at_discharge = models.TextField(blank=True, default="")
    medications_on_discharge = models.TextField(blank=True, default="")
    follow_up_advice = models.TextField(blank=True, default="")

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

    chief_complaints = models.TextField(blank=True, default="")
    co_morbidities = models.TextField(blank=True, default="")
    family_history = models.TextField(blank=True, default="")
    personal_history = models.TextField(blank=True, default="")
    complications_during_stay = models.TextField(blank=True, default="")
    blood_transfusion_details = models.TextField(blank=True, default="")
    implants_used = models.TextField(blank=True, default="")
    indwelling_devices_on_discharge = models.TextField(blank=True, default="")
    vaccination_given = models.TextField(blank=True, default="")
    wound_care_instructions = models.TextField(blank=True, default="")
    stitch_removal_date = models.DateField(null=True, blank=True)
    vitals_at_discharge = models.JSONField(default=dict, blank=True)

    surgery_date = models.DateField(null=True, blank=True)
    surgeon_name = models.CharField(max_length=200, blank=True, default="")
    assistant_name = models.CharField(max_length=200, blank=True, default="")
    anaesthetist_name = models.CharField(max_length=200, blank=True, default="")
    anaesthesia_type = models.CharField(max_length=120, blank=True, default="")
    operative_findings = models.TextField(blank=True, default="")
    intra_op_complications = models.TextField(blank=True, default="")

    discharge_date = models.DateField(null=True, blank=True)
    discharge_time = models.TimeField(null=True, blank=True)
    discharge_type = models.CharField(
        max_length=20, choices=DischargeType.choices, default=DischargeType.ROUTINE, blank=True
    )
    discharge_status = models.CharField(
        max_length=20, choices=DischargeStatus.choices, default=DischargeStatus.IMPROVED, blank=True
    )
    mode_of_admission = models.CharField(
        max_length=20, choices=ModeOfAdmission.choices, default=ModeOfAdmission.OPD, blank=True
    )
    referred_to_facility = models.CharField(max_length=300, blank=True, default="")
    referral_reason = models.TextField(blank=True, default="")
    treating_consultant = models.CharField(max_length=200, blank=True, default="")
    consultant_registration_no = models.CharField(max_length=80, blank=True, default="")
    rmo_signed_by = models.CharField(max_length=200, blank=True, default="")
    next_follow_up_date = models.DateField(null=True, blank=True)
    follow_up_doctor = models.CharField(max_length=200, blank=True, default="")
    follow_up_department = models.CharField(max_length=120, blank=True, default="")

    cause_of_death = models.TextField(blank=True, default="")
    time_of_death = models.DateTimeField(null=True, blank=True)
    notified_to = models.CharField(max_length=300, blank=True, default="")
    autopsy_required = models.BooleanField(default=False)

    abha_id = models.CharField(max_length=64, blank=True, default="")
    insurance_provider = models.CharField(max_length=200, blank=True, default="")
    tpa_name = models.CharField(max_length=200, blank=True, default="")
    policy_number = models.CharField(max_length=120, blank=True, default="")
    claim_number = models.CharField(max_length=120, blank=True, default="")
    patient_education_given = models.BooleanField(default=False)
    attendant_counselled_by = models.CharField(max_length=200, blank=True, default="")

    total_billed = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    outstanding_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    is_draft = models.BooleanField(default=True)

    class Meta:
        ordering = ("-updated_at", "-created_at")

    def __str__(self) -> str:
        return f"Summary for {self.admission.patient.uhid}"


class DischargeSurgery(TimeStampedModel, UUIDPrimaryKeyModel):
    summary = models.ForeignKey(DischargeSummary, on_delete=models.CASCADE, related_name="surgery_rows")
    surgery_date = models.DateField(null=True, blank=True)
    procedure_name = models.CharField(max_length=300)
    surgeon_name = models.CharField(max_length=200, blank=True, default="")
    assistant_name = models.CharField(max_length=200, blank=True, default="")
    anaesthetist_name = models.CharField(max_length=200, blank=True, default="")
    anaesthesia_type = models.CharField(max_length=120, blank=True, default="")
    operative_findings = models.TextField(blank=True, default="")
    intra_op_complications = models.TextField(blank=True, default="")
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ("sort_order", "created_at", "id")


class DischargeMedication(TimeStampedModel, UUIDPrimaryKeyModel):
    summary = models.ForeignKey(DischargeSummary, on_delete=models.CASCADE, related_name="medication_rows")
    drug_name = models.CharField(max_length=200)
    dose = models.CharField(max_length=80, blank=True, default="")
    route = models.CharField(max_length=40, blank=True, default="")
    frequency = models.CharField(max_length=80, blank=True, default="")
    duration = models.CharField(max_length=80, blank=True, default="")
    instructions = models.CharField(max_length=200, blank=True, default="")
    sort_order = models.PositiveSmallIntegerField(default=0)
    # Rich prescription data (pattern, days, timing, stock snapshots) for doctor-style discharge Rx
    rx_meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("sort_order", "created_at", "id")


class DischargeInvestigation(TimeStampedModel, UUIDPrimaryKeyModel):
    class Category(models.TextChoices):
        LAB = "lab", "Lab"
        IMAGING = "imaging", "Imaging"

    summary = models.ForeignKey(DischargeSummary, on_delete=models.CASCADE, related_name="investigation_rows")
    category = models.CharField(max_length=10, choices=Category.choices, default=Category.LAB)
    test_name = models.CharField(max_length=200)
    value = models.CharField(max_length=120, blank=True, default="")
    reference_range = models.CharField(max_length=120, blank=True, default="")
    test_date = models.DateField(null=True, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ("sort_order", "created_at", "id")


class DischargeSummaryTemplate(TimeStampedModel, UUIDPrimaryKeyModel):
    """Hospital-wide reusable discharge summary snapshot."""

    hospital = models.ForeignKey(
        Hospital, on_delete=models.CASCADE, related_name="discharge_summary_templates"
    )
    name = models.CharField(max_length=120)
    payload = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_discharge_summary_templates",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_discharge_summary_templates",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("hospital", "name")]
        ordering = ("name",)
        indexes = [models.Index(fields=["hospital", "is_active"])]

    def __str__(self) -> str:
        return f"{self.name} ({self.hospital_id})"
