from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.inventory.models import Unit
from apps.pharmacy.models import Pharmacy
from apps.shared.models import Hospital


User = get_user_model()


class PharmacyBranchIsolationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.hospital = Hospital.objects.create(name="Default Hospital", slug="default-hospital")
        self.user = User.objects.create_user(
            email="branch@test.com",
            password="x",
            hospital=self.hospital,
        )
        self.client.force_authenticate(self.user)

        self.saroj = Pharmacy.objects.create(
            hospital=self.hospital,
            slug="saroj",
            name="Saroj",
            display_name="Saroj",
            is_active=True,
        )
        self.realizer = Pharmacy.objects.create(
            hospital=self.hospital,
            slug="realizer",
            name="Realizer",
            display_name="Realizer",
            is_active=True,
        )
        Unit.objects.create(pharmacy=self.saroj, code="S-TAB", name="Saroj Tablet")
        Unit.objects.create(pharmacy=self.realizer, code="R-TAB", name="Realizer Tablet")

    def test_units_requires_explicit_branch_header(self):
        response = self.client.get("/api/v1/units/")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Pharmacy branch context required", str(response.data))

    def test_units_are_isolated_by_selected_branch(self):
        saroj_res = self.client.get("/api/v1/units/", HTTP_X_PHARMACY_BRANCH=str(self.saroj.id))
        self.assertEqual(saroj_res.status_code, 200)
        saroj_codes = [row["code"] for row in saroj_res.data.get("results", saroj_res.data)]
        self.assertEqual(saroj_codes, ["S-TAB"])

        realizer_res = self.client.get("/api/v1/units/", HTTP_X_PHARMACY_BRANCH=str(self.realizer.id))
        self.assertEqual(realizer_res.status_code, 200)
        realizer_codes = [row["code"] for row in realizer_res.data.get("results", realizer_res.data)]
        self.assertEqual(realizer_codes, ["R-TAB"])

    def test_new_branch_is_automatically_listed(self):
        Pharmacy.objects.create(
            hospital=self.hospital,
            slug="future-branch",
            name="Future Branch",
            display_name="Future Branch",
            is_active=True,
        )
        anon = APIClient()
        response = anon.get("/api/v1/auth/pharmacies/")
        self.assertEqual(response.status_code, 200)
        labels = [row["label"] for row in response.data.get("data", [])]
        self.assertIn("Future Branch", labels)


class BootstrapPharmacyBranchesCommandTests(TestCase):
    def test_bootstrap_creates_two_default_branches_idempotently(self):
        Hospital.objects.create(name="Default Hospital", slug="default-hospital")

        call_command("bootstrap_pharmacy_branches")
        call_command("bootstrap_pharmacy_branches")

        branches = Pharmacy.objects.filter(hospital__name="Default Hospital", is_active=True).values_list("slug", flat=True)
        self.assertEqual(set(branches), {"saroj", "realizer"})
