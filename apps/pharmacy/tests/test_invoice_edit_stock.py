from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.inventory.models import Medicine, MedicineBatch, StockLedger, Unit
from apps.patients.models import Patient
from apps.pharmacy.models import Pharmacy, PharmacyInvoice, PharmacyInvoiceItem
from apps.shared.models import Hospital

User = get_user_model()


class PharmacyInvoiceEditStockTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.hospital = Hospital.objects.create(
            name="Edit Stock Hospital",
            slug="edit-stock-hospital",
        )
        self.user = User.objects.create_user(
            email="pharm-edit@test.com",
            password="x",
            hospital=self.hospital,
            is_superuser=True,
        )
        self.client.force_authenticate(self.user)

        self.pharmacy = Pharmacy.objects.create(
            hospital=self.hospital,
            slug="edit-pharm",
            name="Edit Pharmacy",
            display_name="Edit Pharmacy",
            is_active=True,
        )
        self.unit = Unit.objects.create(pharmacy=self.pharmacy, code="TAB", name="Tablet")
        self.medicine_a = Medicine.objects.create(
            pharmacy=self.pharmacy,
            sku="MED-A",
            name="Medicine A",
            unit=self.unit,
        )
        self.medicine_b = Medicine.objects.create(
            pharmacy=self.pharmacy,
            sku="MED-B",
            name="Medicine B",
            unit=self.unit,
        )
        self.batch_a = MedicineBatch.objects.create(
            pharmacy=self.pharmacy,
            medicine=self.medicine_a,
            batch_no="BATCH-A",
            expiry_date=timezone.localdate().replace(year=timezone.localdate().year + 2),
            mrp=Decimal("10.00"),
            sale_rate=Decimal("8.00"),
        )
        self.batch_b = MedicineBatch.objects.create(
            pharmacy=self.pharmacy,
            medicine=self.medicine_b,
            batch_no="BATCH-B",
            expiry_date=timezone.localdate().replace(year=timezone.localdate().year + 2),
            mrp=Decimal("12.00"),
            sale_rate=Decimal("10.00"),
        )
        self.patient = Patient.objects.create(
            hospital=self.hospital,
            uhid="UHID-EDIT-001",
            first_name="Edit",
            last_name="Patient",
        )
        self.branch_header = {"HTTP_X_PHARMACY_BRANCH": str(self.pharmacy.id)}

    def _stock_in(self, batch, qty):
        StockLedger.objects.create(
            pharmacy_id=self.pharmacy.id,
            medicine_id=batch.medicine_id,
            batch_id=batch.id,
            qty_change=Decimal(qty),
            reason=StockLedger.Reason.STOCK_IN,
            reference_type="test",
            reference_id="setup",
            created_by=self.user,
        )

    def _dispense_out(self, batch, qty, invoice_id):
        StockLedger.objects.create(
            pharmacy_id=self.pharmacy.id,
            medicine_id=batch.medicine_id,
            batch_id=batch.id,
            qty_change=-Decimal(qty),
            reason=StockLedger.Reason.DISPENSE_OUT,
            reference_type="pharmacy_dispense",
            reference_id=str(invoice_id),
            created_by=self.user,
        )

    def _create_finalized_invoice(self, items):
        invoice = PharmacyInvoice.objects.create(
            pharmacy=self.pharmacy,
            patient=self.patient,
            invoice_no=f"PH-EDIT-{PharmacyInvoice.objects.count() + 1}",
            status=PharmacyInvoice.Status.FINALIZED,
            grand_total=Decimal("100.00"),
            paid_amount=Decimal("100.00"),
            payment_method="cash",
            created_by=self.user,
        )
        for item in items:
            PharmacyInvoiceItem.objects.create(invoice=invoice, **item)
        return invoice

    def _update_full(self, invoice, items):
        return self.client.patch(
            f"/api/v1/pharmacy/invoices/{invoice.id}/update-full/",
            {
                "patient": {"first_name": "Edit", "last_name": "Patient", "phone": ""},
                "invoice": {"payment_method": "cash", "paid_amount": "100.00"},
                "items": items,
            },
            format="json",
            **self.branch_header,
        )

    def _item_payload(self, medicine, batch, qty, free_qty="0"):
        return {
            "medicine": str(medicine.id),
            "batch": str(batch.id),
            "qty": str(qty),
            "free_qty": str(free_qty),
            "mrp": str(batch.mrp),
            "rate": str(batch.sale_rate),
            "cgst_rate": "0",
            "sgst_rate": "0",
        }

    def _available(self, batch):
        total = StockLedger.objects.filter(pharmacy_id=self.pharmacy.id, batch_id=batch.id).aggregate(
            s=Sum("qty_change")
        )["s"]
        return total or Decimal("0")

    def test_edit_remove_line_restores_stock(self):
        self._stock_in(self.batch_a, 20)
        self._stock_in(self.batch_b, 20)
        invoice = self._create_finalized_invoice(
            [
                {
                    "medicine": self.medicine_a,
                    "batch": self.batch_a,
                    "qty": Decimal("5"),
                    "free_qty": Decimal("2"),
                    "mrp": Decimal("10.00"),
                    "rate": Decimal("8.00"),
                    "amount": Decimal("40.00"),
                },
                {
                    "medicine": self.medicine_b,
                    "batch": self.batch_b,
                    "qty": Decimal("3"),
                    "free_qty": Decimal("0"),
                    "mrp": Decimal("12.00"),
                    "rate": Decimal("10.00"),
                    "amount": Decimal("30.00"),
                },
            ]
        )
        self._dispense_out(self.batch_a, 7, invoice.id)
        self._dispense_out(self.batch_b, 3, invoice.id)
        self.assertEqual(self._available(self.batch_a), Decimal("13"))
        self.assertEqual(self._available(self.batch_b), Decimal("17"))

        response = self._update_full(
            invoice,
            [self._item_payload(self.medicine_a, self.batch_a, "5", "2")],
        )
        self.assertEqual(response.status_code, 200)

        restore_b = StockLedger.objects.filter(
            batch_id=self.batch_b.id,
            reason=StockLedger.Reason.RETURN_IN,
            reference_type="pharmacy_edit",
            reference_id=str(invoice.id),
        ).first()
        self.assertIsNotNone(restore_b)
        self.assertEqual(restore_b.qty_change, Decimal("3"))
        self.assertEqual(self._available(self.batch_b), Decimal("20"))
        self.assertEqual(invoice.items.count(), 1)

    def test_edit_reduce_qty_restores_partial_stock(self):
        self._stock_in(self.batch_a, 20)
        invoice = self._create_finalized_invoice(
            [
                {
                    "medicine": self.medicine_a,
                    "batch": self.batch_a,
                    "qty": Decimal("10"),
                    "free_qty": Decimal("0"),
                    "mrp": Decimal("10.00"),
                    "rate": Decimal("8.00"),
                    "amount": Decimal("80.00"),
                }
            ]
        )
        self._dispense_out(self.batch_a, 10, invoice.id)
        self.assertEqual(self._available(self.batch_a), Decimal("10"))

        response = self._update_full(
            invoice,
            [self._item_payload(self.medicine_a, self.batch_a, "6")],
        )
        self.assertEqual(response.status_code, 200)

        restore = StockLedger.objects.filter(
            batch_id=self.batch_a.id,
            reason=StockLedger.Reason.RETURN_IN,
            reference_type="pharmacy_edit",
        ).first()
        self.assertIsNotNone(restore)
        self.assertEqual(restore.qty_change, Decimal("4"))
        self.assertEqual(self._available(self.batch_a), Decimal("14"))

    def test_edit_add_line_deducts_stock(self):
        self._stock_in(self.batch_a, 20)
        self._stock_in(self.batch_b, 20)
        invoice = self._create_finalized_invoice(
            [
                {
                    "medicine": self.medicine_a,
                    "batch": self.batch_a,
                    "qty": Decimal("5"),
                    "free_qty": Decimal("0"),
                    "mrp": Decimal("10.00"),
                    "rate": Decimal("8.00"),
                    "amount": Decimal("40.00"),
                }
            ]
        )
        self._dispense_out(self.batch_a, 5, invoice.id)
        self.assertEqual(self._available(self.batch_b), Decimal("20"))

        response = self._update_full(
            invoice,
            [
                self._item_payload(self.medicine_a, self.batch_a, "5"),
                self._item_payload(self.medicine_b, self.batch_b, "4"),
            ],
        )
        self.assertEqual(response.status_code, 200)

        deduct_b = StockLedger.objects.filter(
            batch_id=self.batch_b.id,
            reason=StockLedger.Reason.DISPENSE_OUT,
            reference_type="pharmacy_dispense",
            reference_id=str(invoice.id),
        ).order_by("-created_at").first()
        self.assertIsNotNone(deduct_b)
        self.assertEqual(deduct_b.qty_change, Decimal("-4"))
        self.assertEqual(self._available(self.batch_b), Decimal("16"))

    def test_edit_increase_qty_deducts_delta_only(self):
        self._stock_in(self.batch_a, 20)
        invoice = self._create_finalized_invoice(
            [
                {
                    "medicine": self.medicine_a,
                    "batch": self.batch_a,
                    "qty": Decimal("5"),
                    "free_qty": Decimal("0"),
                    "mrp": Decimal("10.00"),
                    "rate": Decimal("8.00"),
                    "amount": Decimal("40.00"),
                }
            ]
        )
        self._dispense_out(self.batch_a, 5, invoice.id)
        self.assertEqual(self._available(self.batch_a), Decimal("15"))

        response = self._update_full(
            invoice,
            [self._item_payload(self.medicine_a, self.batch_a, "8")],
        )
        self.assertEqual(response.status_code, 200)

        extra_deduct = StockLedger.objects.filter(
            batch_id=self.batch_a.id,
            reason=StockLedger.Reason.DISPENSE_OUT,
            reference_type="pharmacy_dispense",
            reference_id=str(invoice.id),
            qty_change=Decimal("-3"),
        ).exists()
        self.assertTrue(extra_deduct)
        self.assertEqual(self._available(self.batch_a), Decimal("12"))

    def test_edit_change_batch_restores_old_and_deducts_new(self):
        batch_a2 = MedicineBatch.objects.create(
            pharmacy=self.pharmacy,
            medicine=self.medicine_a,
            batch_no="BATCH-A2",
            expiry_date=timezone.localdate().replace(year=timezone.localdate().year + 3),
            mrp=Decimal("10.00"),
            sale_rate=Decimal("8.00"),
        )
        self._stock_in(self.batch_a, 20)
        self._stock_in(batch_a2, 20)
        invoice = self._create_finalized_invoice(
            [
                {
                    "medicine": self.medicine_a,
                    "batch": self.batch_a,
                    "qty": Decimal("5"),
                    "free_qty": Decimal("0"),
                    "mrp": Decimal("10.00"),
                    "rate": Decimal("8.00"),
                    "amount": Decimal("40.00"),
                }
            ]
        )
        self._dispense_out(self.batch_a, 5, invoice.id)
        self.assertEqual(self._available(batch_a2), Decimal("20"))

        response = self._update_full(
            invoice,
            [self._item_payload(self.medicine_a, batch_a2, "5")],
        )
        self.assertEqual(response.status_code, 200)

        restore_old = StockLedger.objects.filter(
            batch_id=self.batch_a.id,
            reason=StockLedger.Reason.RETURN_IN,
            reference_type="pharmacy_edit",
        ).first()
        self.assertIsNotNone(restore_old)
        self.assertEqual(restore_old.qty_change, Decimal("5"))
        self.assertEqual(self._available(self.batch_a), Decimal("20"))

        deduct_new = StockLedger.objects.filter(
            batch_id=batch_a2.id,
            reason=StockLedger.Reason.DISPENSE_OUT,
            reference_type="pharmacy_dispense",
            qty_change=Decimal("-5"),
        ).exists()
        self.assertTrue(deduct_new)
        self.assertEqual(self._available(batch_a2), Decimal("15"))

    def test_edit_insufficient_stock_fails_and_leaves_invoice_unchanged(self):
        self._stock_in(self.batch_a, 20)
        invoice = self._create_finalized_invoice(
            [
                {
                    "medicine": self.medicine_a,
                    "batch": self.batch_a,
                    "qty": Decimal("5"),
                    "free_qty": Decimal("0"),
                    "mrp": Decimal("10.00"),
                    "rate": Decimal("8.00"),
                    "amount": Decimal("40.00"),
                }
            ]
        )
        self._dispense_out(self.batch_a, 5, invoice.id)
        self.assertEqual(self._available(self.batch_a), Decimal("15"))

        response = self._update_full(
            invoice,
            [self._item_payload(self.medicine_a, self.batch_a, "25")],
        )
        self.assertEqual(response.status_code, 400)
        invoice.refresh_from_db()
        self.assertEqual(invoice.items.count(), 1)
        self.assertEqual(invoice.items.first().qty, Decimal("5"))
        self.assertFalse(
            StockLedger.objects.filter(
                batch_id=self.batch_a.id,
                reference_type="pharmacy_edit",
            ).exists()
        )

    def test_edit_draft_invoice_does_not_change_stock(self):
        draft = PharmacyInvoice.objects.create(
            pharmacy=self.pharmacy,
            patient=self.patient,
            invoice_no="PH-DRAFT-EDIT",
            status=PharmacyInvoice.Status.DRAFT,
            grand_total=Decimal("40.00"),
            created_by=self.user,
        )
        PharmacyInvoiceItem.objects.create(
            invoice=draft,
            medicine=self.medicine_a,
            batch=self.batch_a,
            qty=Decimal("5"),
            free_qty=Decimal("0"),
            mrp=Decimal("10.00"),
            rate=Decimal("8.00"),
            amount=Decimal("40.00"),
        )
        self._stock_in(self.batch_a, 20)
        ledger_count_before = StockLedger.objects.filter(batch_id=self.batch_a.id).count()

        response = self._update_full(
            draft,
            [self._item_payload(self.medicine_a, self.batch_a, "3")],
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            StockLedger.objects.filter(batch_id=self.batch_a.id).count(),
            ledger_count_before,
        )
        draft.refresh_from_db()
        self.assertEqual(draft.items.first().qty, Decimal("3"))

    def test_edit_clears_print_html(self):
        self._stock_in(self.batch_a, 20)
        invoice = self._create_finalized_invoice(
            [
                {
                    "medicine": self.medicine_a,
                    "batch": self.batch_a,
                    "qty": Decimal("5"),
                    "free_qty": Decimal("0"),
                    "mrp": Decimal("10.00"),
                    "rate": Decimal("8.00"),
                    "amount": Decimal("40.00"),
                }
            ]
        )
        self._dispense_out(self.batch_a, 5, invoice.id)
        invoice.print_html = "<html>saved</html>"
        invoice.print_html_updated_at = timezone.now()
        invoice.save(update_fields=["print_html", "print_html_updated_at"])

        response = self._update_full(
            invoice,
            [self._item_payload(self.medicine_a, self.batch_a, "5")],
        )
        self.assertEqual(response.status_code, 200)
        invoice.refresh_from_db()
        self.assertEqual(invoice.print_html, "")
        self.assertIsNone(invoice.print_html_updated_at)
