from django.conf import settings
from django.db import models

from apps.shared.models import Hospital, SoftDeleteModel, TimeStampedModel, UUIDPrimaryKeyModel


class AuditLog(TimeStampedModel, UUIDPrimaryKeyModel):
    """
    Stores an auditable record for critical actions.
    """

    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name="audit_logs", null=True, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs"
    )

    module = models.CharField(max_length=100, db_index=True)
    action = models.CharField(max_length=120, db_index=True)

    object_type = models.CharField(max_length=200, blank=True, default="")
    object_id = models.CharField(max_length=100, blank=True, default="")

    before = models.JSONField(null=True, blank=True, default=None)
    after = models.JSONField(null=True, blank=True, default=None)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")
    request_id = models.CharField(max_length=60, blank=True, default="")

    def __str__(self) -> str:
        return f"{self.module}:{self.action} ({self.request_id})"

