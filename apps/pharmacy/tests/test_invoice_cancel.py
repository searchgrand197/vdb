from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.inventory.models import Medicine, MedicineBatch, StockLedger, Unit
from apps.patients.models import Patient
from apps.pharmacy.invoice_number import next_pharmacy_invoice_number
from apps.pharmacy.models import Pharmacy, PharmacyInvoice, PharmacyInvoiceItem, PharmacyOutletSettings
from apps.shared.models import Hospital

User = get_user_model()


class PharmacyInvoiceCancelTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.hospital = Hospital.objects.create(name="Test Hospital", slug="test-hospital")
        self.user = User.objects.create_user(
            email="pharm-cancel@test.com",
            password="x",
            hospital=self.hospital,
            is_superuser=True,
        )
        self.client.force_authenticate(self.user)

        self.pharmacy = Pharmacy.objects.create(
            hospital=self.hospital,
            slug="test-pharm",
            name="Test Pharmacy",
            display_name="Test Pharmacy",
            is_active=True,
        )
        self.unit = Unit.objects.create(pharmacy=self.pharmacy, code="TAB", name="Tablet")
        self.medicine = Medicine.objects.create(
            pharmacy=self.pharmacy,
            sku="MED-001",
            name="Paracetamol",
            unit=self.unit,
        )
        self.batch = MedicineBatch.objects.create(
            pharmacy=self.pharmacy,
            medicine=self.medicine,
            batch_no="BATCH-001",
            expiry_date=timezone.localdate().replace(year=timezone.localdate().year + 2),
            mrp=Decimal("10.00"),
            sale_rate=Decimal("8.00"),
        )
        self.patient = Patient.objects.create(
            hospital=self.hospital,
            uhid="UHID-001",
            first_name="Test",
            last_name="Patient",
        )

        self.invoice = PharmacyInvoice.objects.create(
            pharmacy=self.pharmacy,
            patient=self.patient,
            invoice_no="PH-TEST-001",
            status=PharmacyInvoice.Status.FINALIZED,
            grand_total=Decimal("100.00"),
            paid_amount=Decimal("100.00"),
            payment_method="cash",
            created_by=self.user,
        )
        self.item = PharmacyInvoiceItem.objects.create(
            invoice=self.invoice,
            medicine=self.medicine,
            batch=self.batch,
            qty=Decimal("3"),
            free_qty=Decimal("2"),
            mrp=Decimal("10.00"),
            rate=Decimal("8.00"),
            amount=Decimal("24.00"),
        )

        self.branch_header = {"HTTP_X_PHARMACY_BRANCH": str(self.pharmacy.id)}

    def _cancel_url(self, invoice_id=None):
        return f"/api/v1/pharmacy/invoices/{invoice_id or self.invoice.id}/cancel/"

    def test_cancel_restores_stock(self):
        response = self.client.post(
            self._cancel_url(),
            {"cancel_reason": "Wrong patient"},
            format="json",
            **self.branch_header,
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get("success"))
        payload = response.data.get("data") or response.data.get("entity") or {}
        self.assertEqual(payload.get("status"), PharmacyInvoice.Status.CANCELLED)
        self.assertEqual(payload.get("cancel_reason"), "Wrong patient")

        restore = StockLedger.objects.filter(
            pharmacy_id=self.pharmacy.id,
            batch_id=self.batch.id,
            reason=StockLedger.Reason.RETURN_IN,
            reference_type="pharmacy_cancel",
            reference_id=str(self.invoice.id),
        ).first()
        self.assertIsNotNone(restore)
        self.assertEqual(restore.qty_change, Decimal("5"))

        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, PharmacyInvoice.Status.CANCELLED)
        self.assertEqual(self.invoice.cancelled_by_id, self.user.id)
        self.assertIsNotNone(self.invoice.cancelled_at)

    def test_cancel_requires_reason(self):
        response = self.client.post(self._cancel_url(), {}, format="json", **self.branch_header)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data.get("success", True))

    def test_cancel_rejects_already_cancelled(self):
        self.invoice.status = PharmacyInvoice.Status.CANCELLED
        self.invoice.cancel_reason = "Already done"
        self.invoice.save(update_fields=["status", "cancel_reason"])

        response = self.client.post(
            self._cancel_url(),
            {"cancel_reason": "Again"},
            format="json",
            **self.branch_header,
        )
        self.assertEqual(response.status_code, 400)

    def test_cancel_rejects_draft(self):
        draft = PharmacyInvoice.objects.create(
            pharmacy=self.pharmacy,
            patient=self.patient,
            invoice_no="PH-DRAFT-001",
            status=PharmacyInvoice.Status.DRAFT,
            grand_total=Decimal("50.00"),
            created_by=self.user,
        )
        response = self.client.post(
            self._cancel_url(draft.id),
            {"cancel_reason": "Mistake"},
            format="json",
            **self.branch_header,
        )
        self.assertEqual(response.status_code, 400)

    def test_cancel_last_invoice_voids_and_reuses_number(self):
        PharmacyOutletSettings.objects.create(
            pharmacy=self.pharmacy,
            business_name="Test",
            b2c_invoice_prefix="INV",
            b2c_invoice_next_number=1,
        )
        inv_no = next_pharmacy_invoice_number(self.pharmacy.id, reserve=True, channel="b2c")
        last_invoice = PharmacyInvoice.objects.create(
            pharmacy=self.pharmacy,
            patient=self.patient,
            invoice_no=inv_no,
            status=PharmacyInvoice.Status.FINALIZED,
            grand_total=Decimal("80.00"),
            paid_amount=Decimal("80.00"),
            payment_method="cash",
            created_by=self.user,
        )
        PharmacyInvoiceItem.objects.create(
            invoice=last_invoice,
            medicine=self.medicine,
            batch=self.batch,
            qty=Decimal("1"),
            free_qty=Decimal("0"),
            mrp=Decimal("10.00"),
            rate=Decimal("8.00"),
            amount=Decimal("8.00"),
        )

        response = self.client.post(
            self._cancel_url(last_invoice.id),
            {"cancel_reason": "Wrong bill"},
            format="json",
            **self.branch_header,
        )
        self.assertEqual(response.status_code, 200)
        payload = response.data.get("data") or response.data.get("entity") or {}
        self.assertTrue(payload.get("voided"))

        last_invoice.refresh_from_db()
        self.assertTrue(last_invoice.voided)
        self.assertTrue(str(last_invoice.invoice_no).startswith("VOID-"))

        list_response = self.client.get(
            "/api/v1/pharmacy/invoices/",
            **self.branch_header,
        )
        ids = [row["id"] for row in (list_response.data.get("data") or list_response.data.get("results") or [])]
        self.assertNotIn(str(last_invoice.id), ids)

        reused_no = next_pharmacy_invoice_number(self.pharmacy.id, reserve=True, channel="b2c")
        self.assertEqual(reused_no, inv_no)

    def test_update_full_blocked_when_cancelled(self):
        self.invoice.status = PharmacyInvoice.Status.CANCELLED
        self.invoice.cancel_reason = "Test"
        self.invoice.save(update_fields=["status", "cancel_reason"])

        response = self.client.patch(
            f"/api/v1/pharmacy/invoices/{self.invoice.id}/update-full/",
            {
                "patient": {"first_name": "Test", "last_name": "Patient", "phone": ""},
                "invoice": {"payment_method": "cash", "paid_amount": "100.00"},
                "items": [
                    {
                        "medicine": str(self.medicine.id),
                        "batch": str(self.batch.id),
                        "qty": "3",
                        "free_qty": "0",
                        "mrp": "10.00",
                        "rate": "8.00",
                        "amount": "24.00",
                    }
                ],
            },
            format="json",
            **self.branch_header,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("view-only", str(response.data.get("detail", "")).lower())
