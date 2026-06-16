from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.billing.models import BillingInvoice, InvoiceNumberSequence
from apps.patients.models import Patient
from apps.payments.models import PaymentSlipSequence, PaymentTransaction
from apps.shared.cancel_service import (
    apply_void_if_last,
    is_last_payment_slip,
    release_payment_slip_number,
    void_payment_slip_sequence,
)
from apps.shared.models import Hospital

User = get_user_model()


class PaymentSlipVoidReuseTests(TestCase):
    def setUp(self):
        self.hospital = Hospital.objects.create(name="Void Hospital", slug="void-hosp")
        self.user = User.objects.create_user(
            email="void@test.com",
            password="x",
            hospital=self.hospital,
            is_superuser=True,
        )
        self.patient = Patient.objects.create(
            hospital=self.hospital,
            uhid="UHID-VOID-1",
            first_name="Void",
            last_name="Patient",
        )
        year = timezone.now().year
        self.seq = PaymentSlipSequence.objects.create(hospital=self.hospital, year=year, last_seq=0)

    def _make_invoice(self, invoice_no: str) -> BillingInvoice:
        return BillingInvoice.objects.create(
            hospital=self.hospital,
            patient=self.patient,
            invoice_no=invoice_no,
            status=BillingInvoice.Status.FINALIZED,
            total_amount=Decimal("100.00"),
            amount_paid=Decimal("0.00"),
        )

    def test_void_last_payment_releases_slip_number_for_reuse(self):
        inv = self._make_invoice("RCPT-1")
        payment = PaymentTransaction(
            hospital=self.hospital,
            invoice=inv,
            payment_mode=PaymentTransaction.PaymentMode.CASH,
            amount=Decimal("100.00"),
            collected_by=self.user,
            paid_at=timezone.now(),
        )
        payment.save()
        original_slip = payment.slip_number
        self.assertTrue(original_slip)
        self.assertTrue(is_last_payment_slip(payment))

        voided = apply_void_if_last(
            obj=payment,
            is_last_fn=is_last_payment_slip,
            void_seq_fn=void_payment_slip_sequence,
            release_number_fn=release_payment_slip_number,
        )
        self.assertTrue(voided)
        payment.status = PaymentTransaction.Status.CANCELLED
        payment.save(update_fields=["status", "voided", "slip_number", "updated_at"])

        self.assertTrue(payment.voided)
        self.assertTrue(str(payment.slip_number).startswith("VOID-"))
        self.assertFalse(
            PaymentTransaction.objects.filter(slip_number=original_slip).exclude(voided=True).exists()
        )

        inv2 = self._make_invoice("RCPT-2")
        payment2 = PaymentTransaction(
            hospital=self.hospital,
            invoice=inv2,
            payment_mode=PaymentTransaction.PaymentMode.CASH,
            amount=Decimal("50.00"),
            collected_by=self.user,
            paid_at=timezone.now(),
        )
        payment2.save()
        self.assertEqual(payment2.slip_number, original_slip)

    def test_generate_reuses_number_when_voided_holder_still_has_old_slip(self):
        """Self-heal: voided payment with unreleased slip_number must not block reuse."""
        from apps.shared.cancel_service import repair_stale_voided_payment_slip_numbers

        inv = self._make_invoice("RCPT-stale")
        payment = PaymentTransaction(
            hospital=self.hospital,
            invoice=inv,
            payment_mode=PaymentTransaction.PaymentMode.CASH,
            amount=Decimal("100.00"),
            collected_by=self.user,
            paid_at=timezone.now(),
        )
        payment.save()
        original_slip = payment.slip_number

        apply_void_if_last(
            obj=payment,
            is_last_fn=is_last_payment_slip,
            void_seq_fn=void_payment_slip_sequence,
            release_number_fn=release_payment_slip_number,
        )
        payment.status = PaymentTransaction.Status.CANCELLED
        payment.voided = True
        # Simulate legacy row: voided but number not tombstoned
        payment.save(update_fields=["status", "voided", "updated_at"])

        inv2 = self._make_invoice("RCPT-stale-2")
        payment2 = PaymentTransaction(
            hospital=self.hospital,
            invoice=inv2,
            payment_mode=PaymentTransaction.PaymentMode.CASH,
            amount=Decimal("50.00"),
            collected_by=self.user,
            paid_at=timezone.now(),
        )
        payment2.save()
        self.assertEqual(payment2.slip_number, original_slip)

        payment.refresh_from_db()
        self.assertTrue(str(payment.slip_number).startswith("VOID-"))
        self.assertEqual(repair_stale_voided_payment_slip_numbers(hospital_id=self.hospital.id), 0)
