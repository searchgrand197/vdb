from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter

from apps.ipd.models import Scheme
from apps.ipd.scheme_serializers import SchemeCreateUpdateSerializer, SchemeSerializer
from apps.staff.views import HospitalScopedMixin


class SchemeViewSet(HospitalScopedMixin, viewsets.ModelViewSet):
    queryset = Scheme.objects.filter(is_deleted=False)
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = (DjangoFilterBackend, SearchFilter, OrderingFilter)
    filterset_fields = ("is_active",)
    search_fields = ("name", "description")
    ordering_fields = ("name", "created_at", "updated_at", "is_active")
    ordering = ("name",)

    def get_queryset(self):
        qs = super().get_queryset()
        show_all = str(self.request.query_params.get("all") or "").lower() in {"1", "true", "yes"}
        if not show_all:
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return SchemeSerializer
        return SchemeCreateUpdateSerializer

    def perform_create(self, serializer):
        user = self.request.user
        vd = dict(serializer.validated_data)
        if user.is_superuser:
            body_hid = vd.pop("hospital_id", None)
            final_hid = body_hid or user.hospital_id
        else:
            vd.pop("hospital_id", None)
            final_hid = user.hospital_id
        if final_hid is None:
            raise ValidationError(
                {"hospital_id": ["Required: assign a hospital to your user or pass hospital_id."]}
            )
        serializer.save(hospital_id=final_hid, **vd)

    def perform_update(self, serializer):
        vd = dict(serializer.validated_data)
        vd.pop("hospital_id", None)
        serializer.save(**vd)
