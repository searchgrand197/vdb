from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.opd.models import OPDVisit
from apps.patients.models import Patient
from apps.payments.models import CashHandover
from apps.settings_management.models import ReceptionPortalSettings
from apps.shared.models import Hospital


User = get_user_model()


class CashHandoverFlowTests(APITestCase):
    def setUp(self):
        self.hospital = Hospital.objects.create(name="Test Hospital", slug="test-hospital")
        self.other_hospital = Hospital.objects.create(name="Other Hospital", slug="other-hospital")
        self.user_a = User.objects.create_user(
            email="a@example.com",
            password="Password@123",
            hospital=self.hospital,
            first_name="User",
            last_name="A",
        )
        self.user_b = User.objects.create_user(
            email="b@example.com",
            password="Password@123",
            hospital=self.hospital,
            first_name="User",
            last_name="B",
        )
        self.user_c = User.objects.create_user(
            email="c@example.com",
            password="Password@123",
            hospital=self.hospital,
            first_name="User",
            last_name="C",
        )
        self.user_other_hospital = User.objects.create_user(
            email="other@example.com",
            password="Password@123",
            hospital=self.other_hospital,
            first_name="Other",
            last_name="Hospital",
        )
        self.admin_user = User.objects.create_user(
            email="admin@example.com",
            password="Password@123",
            hospital=self.hospital,
            first_name="Hospital",
            last_name="Admin",
            is_superuser=True,
        )
        self.patient = Patient.objects.create(
            hospital=self.hospital,
            uhid="UH-TEST-001",
            first_name="Test",
            last_name="Patient",
        )

    def test_only_recipient_can_verify_handover(self):
        handover = CashHandover.objects.create(
            hospital=self.hospital,
            from_user=self.user_a,
            to_user=self.user_b,
            system_cash_amount=Decimal("1000.00"),
            declared_cash_amount=Decimal("1000.00"),
            status=CashHandover.Status.PENDING,
        )

        self.client.force_authenticate(user=self.user_c)
        response = self.client.post(
            "/api/v1/handovers/verify/",
            {"handover_id": str(handover.id), "action": "accept"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        handover.refresh_from_db()
        self.assertEqual(handover.status, CashHandover.Status.PENDING)

    def test_accept_flow_sets_opening_cash_and_resets_after_next_handover(self):
        self.client.force_authenticate(user=self.user_a)
        create_response = self.client.post(
            "/api/v1/handovers/initiate/",
            {
                "to_user_id": str(self.user_b.id),
                "declared_cash_amount": "1500.00",
                "notes": "Shift handover",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        handover_id = create_response.data["data"]["id"]

        self.client.force_authenticate(user=self.user_b)
        accept_response = self.client.post(
            "/api/v1/handovers/verify/",
            {"handover_id": handover_id, "action": "accept"},
            format="json",
        )
        self.assertEqual(accept_response.status_code, 200)

        # Receiver starts with accepted opening cash in hand.
        b_balance = self.client.get("/api/v1/handovers/balance/")
        self.assertEqual(b_balance.status_code, 200)
        self.assertEqual(b_balance.data["data"]["collection"]["opening_cash_in_hand"], "1500.00")
        self.assertEqual(b_balance.data["data"]["collection"]["cash_total"], "1500.00")

        # B now hands over to C and once accepted, B collection resets to zero.
        initiate_b_to_c = self.client.post(
            "/api/v1/handovers/initiate/",
            {
                "to_user_id": str(self.user_c.id),
                "declared_cash_amount": "1500.00",
            },
            format="json",
        )
        self.assertEqual(initiate_b_to_c.status_code, 201)
        b_to_c_id = initiate_b_to_c.data["data"]["id"]

        self.client.force_authenticate(user=self.user_c)
        accept_b_to_c = self.client.post(
            "/api/v1/handovers/verify/",
            {"handover_id": b_to_c_id, "action": "accept"},
            format="json",
        )
        self.assertEqual(accept_b_to_c.status_code, 200)

        self.client.force_authenticate(user=self.user_b)
        b_after_reset = self.client.get("/api/v1/handovers/balance/")
        self.assertEqual(b_after_reset.status_code, 200)
        self.assertEqual(b_after_reset.data["data"]["collection"]["opening_cash_in_hand"], "0.00")
        self.assertEqual(b_after_reset.data["data"]["collection"]["cash_total"], "0.00")

    def test_cross_hospital_user_not_visible_or_selectable(self):
        self.client.force_authenticate(user=self.user_a)
        balance_response = self.client.get("/api/v1/handovers/balance/")
        self.assertEqual(balance_response.status_code, 200)

        recipient_ids = {row["id"] for row in balance_response.data["data"]["handover_recipients"]}
        self.assertIn(str(self.user_b.id), recipient_ids)
        self.assertIn(str(self.user_c.id), recipient_ids)
        self.assertNotIn(str(self.user_other_hospital.id), recipient_ids)

        initiate_cross_hospital = self.client.post(
            "/api/v1/handovers/initiate/",
            {
                "to_user_id": str(self.user_other_hospital.id),
                "declared_cash_amount": "500.00",
            },
            format="json",
        )
        self.assertEqual(initiate_cross_hospital.status_code, 404)

    def test_hospital_collection_forbidden_for_non_admin(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get("/api/v1/handovers/hospital-collection/")
        self.assertEqual(response.status_code, 403)

    def test_hospital_collection_respects_date_range(self):
        today = timezone.localdate()
        in_range = OPDVisit.objects.create(
            hospital=self.hospital,
            patient=self.patient,
            visit_date=today,
            queue_number=1,
            amount=Decimal("100.00"),
            payment_mode=OPDVisit.PaymentMode.CASH,
            status=OPDVisit.Status.COMPLETED,
            created_by=self.user_a,
        )
        out_of_range = OPDVisit.objects.create(
            hospital=self.hospital,
            patient=self.patient,
            visit_date=today - timedelta(days=40),
            queue_number=2,
            amount=Decimal("200.00"),
            payment_mode=OPDVisit.PaymentMode.CASH,
            status=OPDVisit.Status.COMPLETED,
            created_by=self.user_a,
        )
        old_ts = timezone.now() - timedelta(days=40)
        OPDVisit.objects.filter(pk=out_of_range.pk).update(created_at=old_ts)

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(
            "/api/v1/handovers/hospital-collection/",
            {
                "date_from": today.replace(day=1).isoformat(),
                "date_to": today.isoformat(),
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.data["data"]
        self.assertEqual(payload["collection"]["cash_total"], "100.00")
        entry_ids = {row["id"] for row in payload["collection_entries"]}
        self.assertIn(str(in_range.id), entry_ids)
        self.assertNotIn(str(out_of_range.id), entry_ids)

    def _disable_reception_collection(self):
        settings, _ = ReceptionPortalSettings.objects.get_or_create(hospital=self.hospital)
        settings.reception_collection_enabled = False
        settings.save(update_fields=["reception_collection_enabled", "updated_at"])

    def test_balance_forbidden_when_reception_collection_disabled(self):
        self._disable_reception_collection()
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get("/api/v1/handovers/balance/")
        self.assertEqual(response.status_code, 403)

    def test_initiate_forbidden_when_reception_collection_disabled(self):
        self._disable_reception_collection()
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post(
            "/api/v1/handovers/initiate/",
            {
                "to_user_id": str(self.user_b.id),
                "declared_cash_amount": "500.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_verify_forbidden_when_reception_collection_disabled(self):
        self._disable_reception_collection()
        handover = CashHandover.objects.create(
            hospital=self.hospital,
            from_user=self.user_a,
            to_user=self.user_b,
            system_cash_amount=Decimal("1000.00"),
            declared_cash_amount=Decimal("1000.00"),
            status=CashHandover.Status.PENDING,
        )
        self.client.force_authenticate(user=self.user_b)
        response = self.client.post(
            "/api/v1/handovers/verify/",
            {"handover_id": str(handover.id), "action": "accept"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_hospital_collection_omits_handover_data_when_disabled(self):
        today = timezone.localdate()
        handover = CashHandover.objects.create(
            hospital=self.hospital,
            from_user=self.user_a,
            to_user=self.user_b,
            system_cash_amount=Decimal("800.00"),
            declared_cash_amount=Decimal("800.00"),
            status=CashHandover.Status.ACCEPTED,
            accepted_at=timezone.now(),
        )
        OPDVisit.objects.create(
            hospital=self.hospital,
            patient=self.patient,
            visit_date=today,
            queue_number=3,
            amount=Decimal("50.00"),
            payment_mode=OPDVisit.PaymentMode.CASH,
            status=OPDVisit.Status.COMPLETED,
            created_by=self.user_a,
        )
        self._disable_reception_collection()
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(
            "/api/v1/handovers/hospital-collection/",
            {"date_from": today.isoformat(), "date_to": today.isoformat()},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.data["data"]
        self.assertFalse(payload["reception_collection_enabled"])
        self.assertEqual(payload["pending_received"], [])
        entry_types = {row["entry_type"] for row in payload["collection_entries"]}
        self.assertNotIn("handover", entry_types)
        self.assertIn("opd", entry_types)
