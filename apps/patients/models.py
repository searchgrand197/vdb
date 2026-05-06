from django.conf import settings
from django.db import models

from apps.shared.models import Hospital, SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel


class UHIDSequence(TimeStampedModel):
    """
    Stores the last generated UHID sequence per hospital per year.
    """

    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="uhid_sequences")
    year = models.PositiveIntegerField()
    last_seq = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [("hospital", "year")]
        indexes = [models.Index(fields=["hospital", "year"])]


class PatientFamilyGroup(TimeStampedModel, UUIDPrimaryKeyModel):
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="family_groups")
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=64, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=["hospital", "name"])]

    def __str__(self) -> str:
        return self.name


class Patient(SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel):
    class Gender(models.TextChoices):
        MALE = "male"
        FEMALE = "female"
        OTHER = "other"

    class Status(models.TextChoices):
        ACTIVE = "active"
        INACTIVE = "inactive"
        MERGED = "merged"

    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="patients")
    uhid = models.CharField(max_length=40)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    patient_type = models.CharField(max_length=50, blank=True, default="")

    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, default="")
    last_name = models.CharField(max_length=100, blank=True, default="")
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True, default=Gender.OTHER)
    dob = models.DateField(null=True, blank=True)
    # OPD/reception honorific: '' = use age+gender rules; 'none' = no prefix; else Mr/Mrs/Master/Miss.
    preferred_salutation = models.CharField(max_length=16, blank=True, default="")

    phone = models.CharField(max_length=25, blank=True, default="")
    email = models.EmailField(blank=True, default="")

    blood_group = models.CharField(max_length=5, blank=True, default="")

    # Receptionist context: why this patient was registered (visible on patient record).
    registration_note = models.TextField(blank=True, default="")

    emergency_tags = models.CharField(max_length=200, blank=True, default="")

    family_group = models.ForeignKey(
        PatientFamilyGroup, null=True, blank=True, on_delete=models.SET_NULL, related_name="patients"
    )

    merged_into = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="merged_patients"
    )
    merged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("hospital", "uhid")]
        indexes = [
            models.Index(fields=["hospital", "uhid"]),
            models.Index(fields=["hospital", "phone"]),
            models.Index(fields=["hospital", "first_name", "last_name"]),
            models.Index(fields=["hospital", "dob"]),
        ]

    def __str__(self) -> str:
        return f"{self.uhid} - {self.first_name} {self.last_name}"


class PatientAddress(TimeStampedModel, UUIDPrimaryKeyModel):
    patient = models.OneToOneField(Patient, on_delete=models.CASCADE, related_name="address")

    line1 = models.CharField(max_length=200, blank=True, default="")
    line2 = models.CharField(max_length=200, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    state = models.CharField(max_length=100, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="India")
    postal_code = models.CharField(max_length=20, blank=True, default="")


class PatientGuardian(TimeStampedModel, UUIDPrimaryKeyModel):
    patient = models.OneToOneField(Patient, on_delete=models.CASCADE, related_name="guardian")

    name = models.CharField(max_length=200)
    relationship = models.CharField(max_length=100, blank=True, default="")
    phone = models.CharField(max_length=25, blank=True, default="")
    email = models.EmailField(blank=True, default="")


class EmergencyContact(TimeStampedModel, UUIDPrimaryKeyModel):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="emergency_contacts")

    name = models.CharField(max_length=200)
    relationship = models.CharField(max_length=100, blank=True, default="")
    phone = models.CharField(max_length=25, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        indexes = [models.Index(fields=["patient", "phone"])]


class PatientTag(TimeStampedModel, UUIDPrimaryKeyModel):
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="patient_tags")
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=64)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("hospital", "code")]
        indexes = [models.Index(fields=["hospital", "name"])]

    def __str__(self) -> str:
        return self.name


class PatientTagAssignment(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="tag_assignments")
    tag = models.ForeignKey(PatientTag, on_delete=models.CASCADE, related_name="assignments")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("patient", "tag")]


class Allergy(SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="allergies")
    allergy = models.CharField(max_length=200)
    reaction = models.CharField(max_length=200, blank=True, default="")
    severity = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        indexes = [models.Index(fields=["patient", "allergy"])]


class ChronicDisease(SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="chronic_diseases")
    disease = models.CharField(max_length=200)
    diagnosis_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        indexes = [models.Index(fields=["patient", "disease"])]


class PatientActivity(SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel):
    class ActivityType(models.TextChoices):
        NOTE = "note"
        STATUS = "status"
        REMARK = "remark"
        THREAD = "thread"

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="patient_activities")

    activity_type = models.CharField(max_length=20, choices=ActivityType.choices, default=ActivityType.NOTE)
    content = models.TextField()
    internal = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=["patient", "activity_type"])]

