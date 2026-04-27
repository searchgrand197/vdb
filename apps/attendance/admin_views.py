from rest_framework import permissions, serializers, viewsets

from apps.accounts.views import SuperuserOnly
from apps.attendance.models import AttendanceRegularization, LeaveApplication, StaffDailyAttendance, StaffLeaveBalance


class StaffDailyAttendanceAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffDailyAttendance
        fields = "__all__"


class AttendanceRegularizationAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceRegularization
        fields = "__all__"


class LeaveApplicationAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveApplication
        fields = "__all__"


class StaffLeaveBalanceAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffLeaveBalance
        fields = "__all__"


class StaffDailyAttendanceAdminViewSet(viewsets.ModelViewSet):
    queryset = StaffDailyAttendance.objects.select_related("staff", "hospital").all().order_by("-attendance_date", "-created_at")
    serializer_class = StaffDailyAttendanceAdminSerializer
    permission_classes = [permissions.IsAuthenticated, SuperuserOnly]


class AttendanceRegularizationAdminViewSet(viewsets.ModelViewSet):
    queryset = AttendanceRegularization.objects.select_related("staff", "hospital", "reviewed_by").all().order_by("-created_at")
    serializer_class = AttendanceRegularizationAdminSerializer
    permission_classes = [permissions.IsAuthenticated, SuperuserOnly]


class LeaveApplicationAdminViewSet(viewsets.ModelViewSet):
    queryset = LeaveApplication.objects.select_related("staff", "hospital", "approved_by").all().order_by("-created_at")
    serializer_class = LeaveApplicationAdminSerializer
    permission_classes = [permissions.IsAuthenticated, SuperuserOnly]


class StaffLeaveBalanceAdminViewSet(viewsets.ModelViewSet):
    queryset = StaffLeaveBalance.objects.select_related("staff").all().order_by("-updated_at")
    serializer_class = StaffLeaveBalanceAdminSerializer
    permission_classes = [permissions.IsAuthenticated, SuperuserOnly]
