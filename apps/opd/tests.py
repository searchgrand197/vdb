from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.opd.models import OPDVisit, OPDVisitStatusHistory
from unittest.mock import patch

from apps.opd.sms_utils import format_phone_e164, resolve_patient_sms_phone
from apps.patients.models import Patient
from apps.shared.models import Hospital


User = get_user_model()


class OPDPhoneFormatTests(TestCase):
    def test_adds_india_country_code_for_ten_digit_number(self):
        self.assertEqual(format_phone_e164("8814067670"), "+918814067670")

    def test_keeps_existing_plus_prefix(self):
        self.assertEqual(format_phone_e164("+918814067670"), "+918814067670")

    def test_adds_plus_for_ninety_one_prefix_without_plus(self):
        self.assertEqual(format_phone_e164("918814067670"), "+918814067670")

    def test_returns_none_for_empty_phone(self):
        self.assertIsNone(format_phone_e164(""))
        self.assertIsNone(format_phone_e164(None))


class OPDSmsSignalTests(TestCase):
    def setUp(self):
        self.hospital = Hospital.objects.create(name="SMS Hospital", slug="sms-hospital")
        self.user = User.objects.create_user(
            email="sms@test.com",
            password="x",
            hospital=self.hospital,
            is_active=True,
        )
        self.patient = Patient.objects.create(
            hospital=self.hospital,
            uhid="UHID-SMS-1",
            first_name="Ravi",
            last_name="Kumar",
            gender="male",
            phone="8295110043",
            status="active",
        )

    @patch("apps.opd.sms_utils.send_opd_scheduled_sms")
    @patch("apps.opd.signals.transaction.on_commit")
    def test_post_save_signal_sends_sms_on_create(self, mock_on_commit, mock_send):
        mock_on_commit.side_effect = lambda callback: callback()
        visit = OPDVisit.objects.create(
            hospital=self.hospital,
            patient=self.patient,
            visit_date="2026-05-17",
            queue_number=1,
            doctor_user=self.user,
            created_by=self.user,
            status=OPDVisit.Status.WAITING,
        )
        mock_send.assert_called_once_with(visit.pk)

    def test_guardian_phone_used_when_patient_phone_empty(self):
        from apps.patients.models import PatientGuardian

        self.patient.phone = ""
        self.patient.save(update_fields=["phone"])
        PatientGuardian.objects.create(
            patient=self.patient,
            name="Guardian",
            phone="8814067670",
        )
        self.patient.refresh_from_db()
        self.assertEqual(resolve_patient_sms_phone(self.patient), "+918814067670")


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
