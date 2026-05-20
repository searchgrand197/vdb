from __future__ import annotations

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.payments.models import PaymentTransaction


@receiver(post_save, sender=PaymentTransaction)
def send_payment_slip_sms_after_create(sender, instance: PaymentTransaction, created: bool, **kwargs):
    if not created:
        return

    payment_id = instance.pk

    def _send():
        from apps.payments.slip_sms import send_payment_slip_link_sms

        send_payment_slip_link_sms(payment_id)

    transaction.on_commit(_send)
