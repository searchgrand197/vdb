from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.db.models import Max
from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from apps.roles_permissions.permissions import HasRequiredPermission
from apps.shared.master_delete import (
    build_linked_doctors,
    build_linked_specialties,
    build_linked_staff,
    operational_doctors_for_department,
    operational_specialties_for_department,
    operational_staff_for_department,
    operational_staff_for_designation,
)
from apps.shared.response import success_response
from apps.staff.models import (
    Department,
    Designation,
    EmergencyContact,
    Shift,
    StaffAvailabilityOverride,
    StaffProfile,
    StaffShiftAssignment,
)
from apps.staff.serializers import (
    DepartmentCreateUpdateSerializer,
    DepartmentSerializer,
    DesignationCreateUpdateSerializer,
    DesignationSerializer,
    EmergencyContactCreateUpdateSerializer,
    EmergencyContactSerializer,
    ShiftCreateUpdateSerializer,
    ShiftSerializer,
    StaffAvailabilityOverrideCreateUpdateSerializer,
    StaffAvailabilityOverrideSerializer,
    StaffProfileCreateUpdateSerializer,
    StaffProfileSerializer,
    StaffShiftAssignmentCreateUpdateSerializer,
    StaffShiftAssignmentSerializer,
)


def _initial_password_for_staff_user(*, email: str, first_name: str) -> str:
    """
    Human-readable default login password for auto-created staff users:
    lowercase first name + '1234', e.g. first name 'Test' -> 'test1234'.
    Falls back to the email local-part, then 'staff', if the name yields no letters/digits.
    """
    raw = (first_name or "").strip().lower()
    base = "".join(ch for ch in raw if ch.isalnum())
    if not base:
        local = (email or "").split("@", 1)[0].strip().lower()
        base = "".join(ch for ch in local if ch.isalnum())
    if not base:
        base = "staff"
    return f"{base}1234"


class HospitalScopedMixin:
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return qs
        # All of these staff models carry hospital FK.
        if user.hospital_id is None:
            # Avoid filter(hospital_id=None) which matches only NULL FKs (usually none).
            return qs.none()
        return qs.filter(hospital_id=user.hospital_id)


class DepartmentViewSet(HospitalScopedMixin, viewsets.ModelViewSet):
    queryset = Department.objects.filter(is_deleted=False)
    filter_backends = (DjangoFilterBackend, SearchFilter, OrderingFilter)
    filterset_fields = ("hospital_id", "id")
    search_fields = ("code", "name", "description")
    ordering_fields = ("name", "code", "created_at", "updated_at", "is_active")
    ordering = ("name",)

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    required_permission_map = {
        "list": "staff.view_department",
        "retrieve": "staff.view_department",
        "create": "staff.create_department",
        "update": "staff.update_department",
        "partial_update": "staff.update_department",
        "destroy": "staff.delete_department",
    }

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return DepartmentSerializer
        return DepartmentCreateUpdateSerializer

    def get_required_permission(self) -> str | None:
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def perform_create(self, serializer):
        user = self.request.user
        vd = serializer.validated_data
        if user.is_superuser:
            body_hid = vd.pop("hospital_id", None)
            final_hid = body_hid or user.hospital_id
        else:
            final_hid = user.hospital_id
        if final_hid is None:
            raise ValidationError(
                {"hospital_id": ["Required: assign a hospital to your user or pass hospital_id."]}
            )
        serializer.save(hospital_id=final_hid)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        read = DepartmentSerializer(serializer.instance, context={"request": request})
        return success_response(data=read.data, status_code=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return success_response(data=DepartmentSerializer(instance, context={"request": request}).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        read = DepartmentSerializer(serializer.instance, context={"request": request})
        return success_response(data=read.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        Archive when no operational links remain; otherwise return who is still linked.
        """
        department = self.get_object()

        staff_qs = operational_staff_for_department(department)
        doctors_qs = operational_doctors_for_department(department)
        specialties_qs = operational_specialties_for_department(department)

        linked_staff, staff_count = build_linked_staff(staff_qs)
        linked_doctors, doctors_count = build_linked_doctors(doctors_qs)
        linked_specialties, specialties_count = build_linked_specialties(specialties_qs)

        if not staff_count and not doctors_count and not specialties_count:
            pk = department.pk
            department.delete()
            return success_response(
                data={"id": str(pk), "message": "Department deleted successfully."},
            )

        return Response(
            {
                "success": False,
                "errors": {
                    "detail": (
                        "Cannot delete this department while it is linked to staff profiles, doctors, or specialties. "
                        "Reassign or remove those records first."
                    ),
                    "linked_staff": linked_staff,
                    "linked_doctors": linked_doctors,
                    "linked_specialties": linked_specialties,
                    "linked_counts": {
                        "staff": staff_count,
                        "doctors": doctors_count,
                        "specialties": specialties_count,
                    },
                    "truncated": {
                        "staff": staff_count > len(linked_staff),
                        "doctors": doctors_count > len(linked_doctors),
                        "specialties": specialties_count > len(linked_specialties),
                    },
                },
            },
            status=status.HTTP_409_CONFLICT,
        )


class DesignationViewSet(HospitalScopedMixin, viewsets.ModelViewSet):
    queryset = Designation.objects.filter(is_deleted=False).prefetch_related("allowed_pharmacies")
    filter_backends = (SearchFilter,)
    search_fields = ("code", "name")

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    required_permission_map = {
        "list": "staff.view_designation",
        "retrieve": "staff.view_designation",
        "create": "staff.create_designation",
        "update": "staff.update_designation",
        "partial_update": "staff.update_designation",
        "destroy": "staff.delete_designation",
    }

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return DesignationSerializer
        return DesignationCreateUpdateSerializer

    def get_required_permission(self) -> str | None:
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(hospital_id=self.request.user.hospital_id)

    def destroy(self, request, *args, **kwargs):
        """
        Archive when no operational staff links remain; otherwise return linked staff.
        """
        designation = self.get_object()

        staff_qs = operational_staff_for_designation(designation)
        linked_staff, staff_count = build_linked_staff(staff_qs)

        if staff_count == 0:
            pk = designation.pk
            designation.delete()
            return success_response(
                data={"id": str(pk), "message": "Designation deleted successfully."},
            )

        return Response(
            {
                "success": False,
                "errors": {
                    "detail": (
                        "Cannot delete this designation while it is linked to staff profiles. "
                        "Reassign or remove those staff records first."
                    ),
                    "linked_staff": linked_staff,
                    "linked_counts": {
                        "staff": staff_count,
                    },
                    "truncated": {
                        "staff": staff_count > len(linked_staff),
                    },
                },
            },
            status=status.HTTP_409_CONFLICT,
        )


class ShiftViewSet(HospitalScopedMixin, viewsets.ModelViewSet):
    queryset = Shift.objects.all()
    filter_backends = (SearchFilter,)
    search_fields = ("name",)

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    required_permission_map = {
        "list": "staff.view_shift",
        "retrieve": "staff.view_shift",
        "create": "staff.create_shift",
        "update": "staff.update_shift",
        "partial_update": "staff.update_shift",
        "destroy": "staff.delete_shift",
    }

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return ShiftSerializer
        return ShiftCreateUpdateSerializer

    def get_required_permission(self) -> str | None:
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(hospital_id=self.request.user.hospital_id)


class StaffProfileViewSet(HospitalScopedMixin, viewsets.ModelViewSet):
    queryset = StaffProfile.objects.filter(is_deleted=False).select_related(
        "department", "designation", "user"
    ).prefetch_related("allowed_pharmacies")
    filter_backends = (SearchFilter,)
    search_fields = ("employee_code", "first_name", "last_name")

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    required_permission_map = {
        "list": "staff.view_staff",
        "retrieve": "staff.view_staff",
        "create": "staff.create_staff",
        "update": "staff.update_staff",
        "partial_update": "staff.update_staff",
        "destroy": "staff.delete_staff",
    }

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return StaffProfileSerializer
        return StaffProfileCreateUpdateSerializer

    def get_required_permission(self) -> str | None:
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def perform_create(self, serializer):
        request_user = self.request.user
        hospital_id = request_user.hospital_id
        if hospital_id is None and not request_user.is_superuser:
            raise ValidationError({"hospital": ["User is not assigned to any hospital."]})

        vd = serializer.validated_data
        user = vd.get("user")
        email = vd.get("email")
        employee_code = vd.get("employee_code") or ""

        if user is None:
            if not email:
                raise ValidationError({"email": ["This field is required when user is not provided."]})
            UserModel = get_user_model()
            password = _initial_password_for_staff_user(
                email=email,
                first_name=vd.get("first_name", "") or "",
            )
            try:
                user = UserModel.objects.create_user(
                    email=email,
                    password=password,
                    first_name=vd.get("first_name", ""),
                    last_name=vd.get("last_name", ""),
                    hospital_id=hospital_id,
                )
            except IntegrityError:
                # Most likely a duplicate email; surface as a clear 400 error.
                raise ValidationError({"email": ["A user with this email already exists."]})
            # Expose once in the response (not stored in DB).
            serializer._generated_password = password
            vd["user"] = user

            # Send credentials email using the same SMTP pattern as mailtest.py.
            # Wrap in try/except so SMTP issues don't cause 500 on staff create.
            try:
                full_name = (
                    f"{vd.get('first_name', '').strip()} {vd.get('last_name', '').strip()}".strip()
                    or "Staff"
                )
                host = settings.EMAIL_HOST
                port = settings.EMAIL_PORT
                use_ssl = getattr(settings, "EMAIL_USE_SSL", False)
                use_tls = getattr(settings, "EMAIL_USE_TLS", False)
                user_smtp = settings.EMAIL_HOST_USER
                pwd_smtp = settings.EMAIL_HOST_PASSWORD
                from_email = settings.DEFAULT_FROM_EMAIL

                msg = EmailMessage()
                msg["Subject"] = "Your HMS login credentials"
                msg["From"] = from_email
                msg["To"] = email

                text_body = (
                    f"Hello {full_name},\n\n"
                    "Your HMS account has been created.\n\n"
                    f"Login email: {email}\n"
                    f"Temporary password: {password}\n\n"
                    "Please log in and change your password immediately.\n"
                )
                html_body = f"""
                <html>
                  <body>
                    <p>Hello {full_name},</p>
                    <p>Your <strong>HMS</strong> account has been created.</p>
                    <p>
                      <strong>Login email:</strong> {email}<br/>
                      <strong>Temporary password:</strong> {password}
                    </p>
                    <p>Please log in and change your password immediately.</p>
                  </body>
                </html>
                """

                msg.set_content(text_body)
                msg.add_alternative(html_body, subtype="html")

                if use_ssl:
                    context = ssl.create_default_context()
                    with smtplib.SMTP_SSL(host, port, context=context) as server:
                        if user_smtp and pwd_smtp:
                            server.login(user_smtp, pwd_smtp)
                        server.send_message(msg)
                else:
                    with smtplib.SMTP(host, port) as server:
                        if use_tls:
                            server.starttls()
                        if user_smtp and pwd_smtp:
                            server.login(user_smtp, pwd_smtp)
                        server.send_message(msg)
            except Exception as exc:
                print(f"[staff-email] FAILED sending credentials email to {email}: {exc}")

        # Auto-generate employee_code when missing/blank: EMP-0001, EMP-0002, ...
        if not employee_code.strip():
            last_code = (
                StaffProfile.objects.filter(hospital_id=hospital_id)
                .exclude(employee_code="")
                .aggregate(max_code=Max("employee_code"))
                .get("max_code")
            )
            next_number = 1
            if last_code and last_code.startswith("EMP-"):
                suffix = last_code[4:]
                if suffix.isdigit():
                    next_number = int(suffix) + 1
            vd["employee_code"] = f"EMP-{next_number:04d}"

        vd.pop("email", None)
        serializer.save(hospital_id=hospital_id, user=vd.get("user"))

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        data = dict(serializer.data)
        pwd = getattr(serializer, "_generated_password", None)
        if pwd:
            data["initial_password"] = pwd
            # Return login email together with one-time password for convenience.
            if serializer.instance and getattr(serializer.instance, "user", None):
                data["login_email"] = serializer.instance.user.email
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)


class EmergencyContactViewSet(viewsets.ModelViewSet):
    queryset = EmergencyContact.objects.all().select_related("staff")
    filter_backends = (SearchFilter,)
    search_fields = ("name", "phone", "relationship")

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    required_permission_map = {
        "list": "staff.view_emergency_contact",
        "retrieve": "staff.view_emergency_contact",
        "create": "staff.create_emergency_contact",
        "update": "staff.update_emergency_contact",
        "partial_update": "staff.update_emergency_contact",
        "destroy": "staff.delete_emergency_contact",
    }

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return EmergencyContactSerializer
        return EmergencyContactCreateUpdateSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return qs
        return qs.filter(staff__hospital_id=user.hospital_id)

    def get_required_permission(self) -> str | None:
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def perform_create(self, serializer):
        staff = serializer.validated_data["staff"]
        serializer.save(staff=staff)


class StaffShiftAssignmentViewSet(HospitalScopedMixin, viewsets.ModelViewSet):
    queryset = StaffShiftAssignment.objects.all().select_related("staff", "shift", "assigned_by")
    filter_backends = (SearchFilter,)
    search_fields = ("staff__employee_code", "staff__first_name", "staff__last_name", "shift__name")

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    required_permission_map = {
        "list": "staff.view_staffshiftassignment",
        "retrieve": "staff.view_staffshiftassignment",
        "create": "staff.create_staffshiftassignment",
        "update": "staff.update_staffshiftassignment",
        "partial_update": "staff.update_staffshiftassignment",
        "destroy": "staff.delete_staffshiftassignment",
    }

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return StaffShiftAssignmentSerializer
        return StaffShiftAssignmentCreateUpdateSerializer

    def get_required_permission(self) -> str | None:
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def perform_create(self, serializer):
        user = self.request.user
        hospital_id = user.hospital_id
        if hospital_id is None and not user.is_superuser:
            raise ValidationError({"hospital": ["User is not assigned to any hospital."]})
        serializer.save(hospital_id=hospital_id, assigned_by=user)


class StaffAvailabilityOverrideViewSet(HospitalScopedMixin, viewsets.ModelViewSet):
    queryset = StaffAvailabilityOverride.objects.all().select_related("staff", "updated_by")
    filter_backends = (SearchFilter,)
    search_fields = ("staff__employee_code", "staff__first_name", "staff__last_name")

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    required_permission_map = {
        "list": "staff.view_staffavailabilityoverride",
        "retrieve": "staff.view_staffavailabilityoverride",
        "create": "staff.create_staffavailabilityoverride",
        "update": "staff.update_staffavailabilityoverride",
        "partial_update": "staff.update_staffavailabilityoverride",
        "destroy": "staff.delete_staffavailabilityoverride",
    }

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return StaffAvailabilityOverrideSerializer
        return StaffAvailabilityOverrideCreateUpdateSerializer

    def get_required_permission(self) -> str | None:
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def perform_create(self, serializer):
        user = self.request.user
        hospital_id = user.hospital_id
        if hospital_id is None and not user.is_superuser:
            raise ValidationError({"hospital": ["User is not assigned to any hospital."]})
        serializer.save(hospital_id=hospital_id, updated_by=user)

from django.shortcuts import render

# Create your views here.
