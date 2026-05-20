from __future__ import annotations

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.opd.models import OPDVisit


@receiver(post_save, sender=OPDVisit)
def send_opd_sms_after_create(sender, instance: OPDVisit, created: bool, **kwargs):
    """Send Twilio SMS whenever a new OPD visit is saved (any code path)."""
    if not created:
        return

    visit_id = instance.pk

    def _send():
        from apps.opd.sms_utils import send_opd_scheduled_sms

        send_opd_scheduled_sms(visit_id)

    transaction.on_commit(_send)
