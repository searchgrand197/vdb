from django.conf import settings
from django.db import models

from apps.shared.models import Hospital, SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel


class Department(SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel):
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="departments")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=["hospital", "name"])]
        constraints = [
            models.UniqueConstraint(
                fields=["hospital", "code"],
                condition=models.Q(is_deleted=False),
                name="department_hospital_active_code_uniq",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Designation(SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel):
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="designations")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    allowed_portals = models.JSONField(default=list, blank=True)
    # When pharmacy portal is enabled: empty = all branches; non-empty = only listed branches.
    allowed_pharmacies = models.ManyToManyField(
        "pharmacy.Pharmacy",
        blank=True,
        related_name="designations_with_access",
    )

    class Meta:
        indexes = [models.Index(fields=["hospital", "name"])]
        constraints = [
            models.UniqueConstraint(
                fields=["hospital", "code"],
                condition=models.Q(is_deleted=False),
                name="designation_hospital_active_code_uniq",
            ),
        ]


class Shift(TimeStampedModel, UUIDPrimaryKeyModel):
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="shifts")
    name = models.CharField(max_length=200)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("hospital", "name")]

    def __str__(self) -> str:
        return self.name


class StaffProfile(SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel):
    class EmploymentStatus(models.TextChoices):
        ACTIVE = "active"
        INACTIVE = "inactive"
        TERMINATED = "terminated"

    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="staff_profiles")

    # If a staff user uses this same account for login, link it; otherwise null.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff_profiles",
    )

    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="staff", null=True, blank=True)
    designation = models.ForeignKey(
        Designation, on_delete=models.PROTECT, related_name="staff", null=True, blank=True
    )

    employee_code = models.CharField(max_length=80, blank=True, default="")
    first_name = models.CharField(max_length=100, blank=True, default="")
    last_name = models.CharField(max_length=100, blank=True, default="")
    phone = models.CharField(max_length=25, blank=True, default="")
    address = models.TextField(blank=True, default="")
    joining_date = models.DateField(null=True, blank=True)

    employment_status = models.CharField(
        max_length=20, choices=EmploymentStatus.choices, default=EmploymentStatus.ACTIVE, db_index=True
    )

    # Empty = unrestricted (all active pharmacy branches). Non-empty = only listed branches.
    allowed_pharmacies = models.ManyToManyField(
        "pharmacy.Pharmacy",
        blank=True,
        related_name="allowed_staff",
    )

    class Meta:
        indexes = [models.Index(fields=["hospital", "employee_code"])]

    def __str__(self) -> str:
        return self.employee_code or f"Staff {self.id}"


class EmergencyContact(TimeStampedModel, UUIDPrimaryKeyModel):
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="emergency_contacts")
    name = models.CharField(max_length=200)
    relationship = models.CharField(max_length=100, blank=True, default="")
    phone = models.CharField(max_length=25, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        indexes = [models.Index(fields=["staff", "phone"])]

    def __str__(self) -> str:
        return self.name


class StaffIDProof(TimeStampedModel, UUIDPrimaryKeyModel):
    class ProofType(models.TextChoices):
        AADHAR = "aadhar"
        PAN = "pan"
        PASSPORT = "passport"
        OTHER = "other"

    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name="id_proofs")
    proof_type = models.CharField(max_length=20, choices=ProofType.choices, default=ProofType.OTHER)
    number = models.CharField(max_length=100, blank=True, default="")
    issued_at = models.DateField(null=True, blank=True)
    expires_at = models.DateField(null=True, blank=True)

    # Store metadata; actual file reference can be handled by `documents` module later.
    document_metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [models.Index(fields=["staff", "proof_type"])]


class StaffShiftAssignment(TimeStampedModel, UUIDPrimaryKeyModel):
    class AssignmentStatus(models.TextChoices):
        ASSIGNED = "assigned"
        REASSIGNED = "reassigned"
        CANCELLED = "cancelled"

    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="shift_assignments")
    staff = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name="shift_assignments")
    # Start date from which this shift applies.
    date = models.DateField()
    # Optional last date (inclusive) until which the shift applies.
    # If null, treat as open-ended until explicitly changed.
    end_date = models.DateField(null=True, blank=True)
    shift = models.ForeignKey(Shift, on_delete=models.PROTECT, related_name="staff_assignments")
    status = models.CharField(max_length=20, choices=AssignmentStatus.choices, default=AssignmentStatus.ASSIGNED)
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="assigned_shifts")

    class Meta:
        unique_together = [("hospital", "staff", "date")]
        indexes = [models.Index(fields=["hospital", "date"])]


class StaffAvailabilityOverride(TimeStampedModel, UUIDPrimaryKeyModel):
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="availability_overrides")
    staff = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name="availability_overrides")
    date = models.DateField()
    is_available = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="updated_availability")

    class Meta:
        unique_together = [("hospital", "staff", "date")]

