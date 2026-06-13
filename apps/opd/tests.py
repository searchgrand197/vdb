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


class OPDVisitSearchTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.hospital = Hospital.objects.create(name="Search Hospital", slug="search-hospital")
        self.user = User.objects.create_user(
            email="search@test.com",
            password="x",
            hospital=self.hospital,
            is_active=True,
        )
        self.client.force_authenticate(self.user)

        self.patient_primary = Patient.objects.create(
            hospital=self.hospital,
            uhid="UHID-1001",
            first_name="Rahul",
            last_name="Sharma",
            gender="male",
            phone="9876501111",
            status="active",
        )
        self.patient_secondary = Patient.objects.create(
            hospital=self.hospital,
            uhid="UHID-2002",
            first_name="Priya",
            last_name="Verma",
            gender="female",
            phone="9876502222",
            status="active",
        )

        self.primary_visit = OPDVisit.objects.create(
            hospital=self.hospital,
            patient=self.patient_primary,
            visit_date="2026-04-28",
            queue_number=7,
            doctor_user=self.user,
            created_by=self.user,
            visit_reason="General checkup",
            diagnosis="Seasonal fever",
            status=OPDVisit.Status.WAITING,
        )
        self.secondary_visit = OPDVisit.objects.create(
            hospital=self.hospital,
            patient=self.patient_secondary,
            visit_date="2026-04-28",
            queue_number=8,
            doctor_user=self.user,
            created_by=self.user,
            visit_reason="Headache",
            diagnosis="Migraine",
            status=OPDVisit.Status.WAITING,
        )

    def _search_rows(self, query):
        response = self.client.get("/api/v1/opd-visits/", data={"search": query})
        self.assertEqual(response.status_code, 200)
        payload = response.data.get("data", response.data)
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict):
            return payload.get("results", payload.get("data", []))
        return []

    def test_search_matches_patient_name(self):
        rows = self._search_rows("rahul")
        returned_ids = {str(row.get("id")) for row in rows}
        self.assertIn(str(self.primary_visit.id), returned_ids)
        self.assertNotIn(str(self.secondary_visit.id), returned_ids)

    def test_search_matches_patient_mobile(self):
        rows = self._search_rows("9876501111")
        returned_ids = {str(row.get("id")) for row in rows}
        self.assertIn(str(self.primary_visit.id), returned_ids)
        self.assertNotIn(str(self.secondary_visit.id), returned_ids)

    def test_search_matches_patient_uhid(self):
        rows = self._search_rows("UHID-1001")
        returned_ids = {str(row.get("id")) for row in rows}
        self.assertIn(str(self.primary_visit.id), returned_ids)
        self.assertNotIn(str(self.secondary_visit.id), returned_ids)

    def test_search_does_not_match_by_diagnosis_or_reason(self):
        diagnosis_rows = self._search_rows("seasonal fever")
        reason_rows = self._search_rows("general checkup")
        diagnosis_ids = {str(row.get("id")) for row in diagnosis_rows}
        reason_ids = {str(row.get("id")) for row in reason_rows}
        self.assertNotIn(str(self.primary_visit.id), diagnosis_ids)
        self.assertNotIn(str(self.primary_visit.id), reason_ids)
