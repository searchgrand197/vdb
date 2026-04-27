from django.conf import settings
from django.db import models

from apps.shared.models import Hospital, TimeStampedModel, UUIDPrimaryKeyModel


class LeaveApprover(TimeStampedModel, UUIDPrimaryKeyModel):
    """
    Defines who is allowed to approve leave applications for a hospital.
    A hospital can have multiple approvers.
    """

    hospital = models.ForeignKey(
        Hospital,
        on_delete=models.CASCADE,
        related_name="leave_approvers",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="leave_approver_hospitals",
        help_text="User who is permitted to approve leave requests for this hospital.",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Uncheck to temporarily suspend this approver without deleting the record.",
    )
    notes = models.TextField(
        blank=True,
        default="",
        help_text="Optional note (e.g. 'HR Manager', 'Backup approver').",
    )

    class Meta:
        unique_together = [("hospital", "user")]
        verbose_name = "Leave Approver"
        verbose_name_plural = "Leave Approvers"
        ordering = ["hospital__name", "user__email"]

    def __str__(self) -> str:
        return f"{self.user.email} → {self.hospital.name}"


class ReceptionPortalSettings(TimeStampedModel, UUIDPrimaryKeyModel):
    hospital = models.OneToOneField(
        Hospital,
        on_delete=models.CASCADE,
        related_name="reception_portal_settings",
    )
    default_city = models.CharField(max_length=120, blank=True, default="Jind")
    default_state = models.CharField(max_length=120, blank=True, default="Haryana")
    default_doctor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="default_reception_portal_for_hospitals",
    )

    hospital_name = models.CharField(max_length=200, blank=True, default="Vardraan Hospital")
    address = models.CharField(max_length=255, blank=True, default="Jind, Haryana, 126102")
    pin_code = models.CharField(max_length=30, blank=True, default="126102")
    phone = models.CharField(max_length=40, blank=True, default="+91-XXXXXXXXXX")
    email = models.CharField(max_length=120, blank=True, default="info@vardraanhospital.com")
    website = models.CharField(max_length=200, blank=True, default="www.vardraanhospital.com")
    print_with_background = models.BooleanField(default=True)

    def __str__(self) -> str:
        return f"Reception settings ({self.hospital_id})"
