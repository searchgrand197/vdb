from rest_framework import permissions, viewsets
from rest_framework.filters import OrderingFilter

from apps.emergency.models import EmergencyCase
from apps.emergency.serializers import EmergencyCaseSerializer


class EmergencyCaseViewSet(viewsets.ModelViewSet):
    serializer_class = EmergencyCaseSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [OrderingFilter]
    ordering_fields = ["arrived_at", "created_at"]
    ordering = ["-arrived_at"]

    def get_queryset(self):
        user = self.request.user
        hid = getattr(user, "hospital_id", None)
        if not hid:
            return EmergencyCase.objects.none()
        return EmergencyCase.objects.filter(hospital_id=hid)

    def perform_create(self, serializer):
        serializer.save(hospital_id=self.request.user.hospital_id)
