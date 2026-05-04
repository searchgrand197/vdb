from django.contrib import admin

from .models import (
    AttendanceRegularization,
    LeaveApplication,
    MonthlyEarnedLeaveAllocation,
    StaffDailyAttendance,
    StaffLeaveBalance,
)


@admin.register(StaffDailyAttendance)
class StaffDailyAttendanceAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "staff", "attendance_date", "status", "check_in_at", "check_out_at")
    list_filter = ("hospital", "status")


@admin.register(AttendanceRegularization)
class AttendanceRegularizationAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "staff", "attendance_date", "status", "created_at")
    list_filter = ("hospital", "status")


@admin.register(LeaveApplication)
class LeaveApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "staff", "leave_type", "start_date", "end_date", "status", "total_days")
    list_filter = ("hospital", "leave_type", "status")


@admin.register(MonthlyEarnedLeaveAllocation)
class MonthlyEarnedLeaveAllocationAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "year", "month", "designation", "earned_days", "is_applied")


@admin.register(StaffLeaveBalance)
class StaffLeaveBalanceAdmin(admin.ModelAdmin):
    list_display = ("id", "staff", "leave_type", "balance_days")
