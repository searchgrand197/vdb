from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, viewsets, generics
from rest_framework.exceptions import NotFound

from apps.roles_permissions.permissions import HasRequiredPermission
from apps.settings_management.models import LeaveApprover, ReceptionPortalSettings
from apps.settings_management.serializers import LeaveApproverSerializer, ReceptionPortalSettingsSerializer
from apps.shared.response import success_response


class LeaveApproverViewSet(viewsets.ModelViewSet):
    """
    Manage the list of users who are allowed to approve leave applications
    for a given hospital.

    GET  /settings/leave-approvers/           – list approvers for this hospital
    POST /settings/leave-approvers/           – add an approver
    PATCH/PUT /settings/leave-approvers/<id>/ – update (e.g. toggle is_active)
    DELETE /settings/leave-approvers/<id>/    – remove approver
    """

    queryset = LeaveApprover.objects.all().select_related("hospital", "user")
    serializer_class = LeaveApproverSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ("hospital", "is_active")
    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    required_permission_map = {
        "list": "settings.manage_settings",
        "retrieve": "settings.manage_settings",
        "create": "settings.manage_settings",
        "update": "settings.manage_settings",
        "partial_update": "settings.manage_settings",
        "destroy": "settings.manage_settings",
    }

    def get_required_permission(self) -> str | None:
        return self.required_permission_map.get(getattr(self, "action", None))

    def get_permissions(self):
        self.required_permission = self.get_required_permission()
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            hid = self.request.query_params.get("hospital_id")
            if hid:
                qs = qs.filter(hospital_id=hid)
        elif getattr(user, "hospital_id", None):
            qs = qs.filter(hospital_id=user.hospital_id)
        else:
            return qs.none()
        return qs.order_by("user__email")

    def perform_create(self, serializer):
        user = self.request.user
        hid = serializer.validated_data.get("hospital_id") or getattr(user, "hospital_id", None)
        serializer.save(hospital_id=hid)

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        return success_response(data=self.get_serializer(qs, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return success_response(data=self.get_serializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        from rest_framework import status
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        self.perform_create(ser)
        return success_response(data=ser.data, status_code=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        inst = self.get_object()
        ser = self.get_serializer(inst, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)
        ser.save()
        return success_response(data=ser.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        inst = self.get_object()
        pk = inst.pk
        inst.delete()
        return success_response(data={"id": str(pk)})


class ReceptionPortalSettingsView(generics.RetrieveUpdateAPIView):
    serializer_class = ReceptionPortalSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        hospital = getattr(self.request.user, "hospital", None)
        if hospital is None:
            raise NotFound("Hospital context required.")
        obj, _ = ReceptionPortalSettings.objects.get_or_create(
            hospital=hospital,
            defaults={"default_city": "Jind", "default_state": "Haryana"},
        )
        return obj
