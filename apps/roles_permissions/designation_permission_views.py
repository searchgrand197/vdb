from __future__ import annotations

from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import ValidationError

from apps.roles_permissions.designation_permission_serializers import (
    DesignationPermissionProfileCreateSerializer,
    DesignationPermissionProfileSerializer,
    DesignationPermissionProfileUpdateSerializer,
)
from apps.roles_permissions.models import DesignationPermissionProfile
from apps.roles_permissions.permissions import HasRequiredPermission
from apps.shared.response import success_response


class DesignationPermissionProfileViewSet(viewsets.ModelViewSet):
    queryset = DesignationPermissionProfile.objects.all().select_related(
        "designation"
    ).prefetch_related("module_links__module")
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ("designation",)

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    required_permission_map = {
        "list": "staff.view_designation",
        "retrieve": "staff.view_designation",
        "create": "staff.update_designation",
        "update": "staff.update_designation",
        "partial_update": "staff.update_designation",
        "destroy": "staff.update_designation",
    }

    def get_serializer_class(self):
        if self.action == "create":
            return DesignationPermissionProfileCreateSerializer
        if self.action in ("update", "partial_update"):
            return DesignationPermissionProfileUpdateSerializer
        return DesignationPermissionProfileSerializer

    def get_required_permission(self) -> str | None:
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return qs.order_by("designation__name", "id")
        if user.hospital_id is None:
            return qs.none()
        return qs.filter(designation__hospital_id=user.hospital_id).order_by("designation__name", "id")

    def _ensure_designation_in_scope(self, designation):
        req = self.request.user
        if req.is_superuser:
            return
        if designation.hospital_id != req.hospital_id:
            raise ValidationError({"designation": ["Designation is not in your hospital."]})

    def perform_create(self, serializer):
        self._ensure_designation_in_scope(serializer.validated_data["designation"])
        with transaction.atomic():
            serializer.save()

    def perform_update(self, serializer):
        self._ensure_designation_in_scope(serializer.instance.designation)
        with transaction.atomic():
            serializer.save()

    def perform_destroy(self, instance):
        self._ensure_designation_in_scope(instance.designation)
        instance.delete()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        ser = self.get_serializer(queryset, many=True)
        return success_response(data=ser.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return success_response(data=self.get_serializer(instance).data)

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        self.perform_create(ser)
        out = DesignationPermissionProfileSerializer(ser.instance).data
        return success_response(data=out, status_code=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        ser = self.get_serializer(instance, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)
        self.perform_update(ser)
        return success_response(data=DesignationPermissionProfileSerializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        pk = instance.pk
        self.perform_destroy(instance)
        return success_response(data={"id": pk}, status_code=status.HTTP_200_OK)
