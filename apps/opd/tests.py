from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.opd.models import OPDVisit, OPDVisitStatusHistory
from apps.patients.models import Patient
from apps.shared.models import Hospital


User = get_user_model()


class OPDSkippedStatusTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.hospital = Hospital.objects.create(name="Test Hospital", slug="test-hospital")
        self.user = User.objects.create_user(
            email="doctor@test.com",
            password="x",
            hospital=self.hospital,
            is_active=True,
        )
        self.patient = Patient.objects.create(
            hospital=self.hospital,
            uhid="UHID-0001",
            first_name="Test",
            last_name="Patient",
            gender="male",
            phone="9876500001",
            status="active",
        )
        self.visit = OPDVisit.objects.create(
            hospital=self.hospital,
            patient=self.patient,
            visit_date="2026-04-28",
            queue_number=1,
            doctor_user=self.user,
            created_by=self.user,
            visit_reason="Fever",
            status=OPDVisit.Status.IN_PROGRESS,
        )
        self.client.force_authenticate(self.user)

    def test_patch_visit_to_skipped(self):
        response = self.client.patch(
            f"/api/v1/opd-visits/{self.visit.id}/",
            data={"status": OPDVisit.Status.SKIPPED},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.visit.refresh_from_db()
        self.assertEqual(self.visit.status, OPDVisit.Status.SKIPPED)

    def test_status_history_created_for_skipped_transition(self):
        self.client.patch(
            f"/api/v1/opd-visits/{self.visit.id}/",
            data={"status": OPDVisit.Status.SKIPPED},
            format="json",
        )
        history = OPDVisitStatusHistory.objects.filter(visit=self.visit).order_by("-created_at").first()
        self.assertIsNotNone(history)
        self.assertEqual(history.from_status, OPDVisit.Status.IN_PROGRESS)
        self.assertEqual(history.to_status, OPDVisit.Status.SKIPPED)
