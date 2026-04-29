from rest_framework import serializers

from apps.treatment.models import (
    PatientTimeline,
    TreatmentPlan,
    TreatmentPlanItem,
    TreatmentPlanStaffAssignment,
    TreatmentTask,
    TreatmentTemplateCatalog,
)


def _safe_patient_name(patient):
    if not patient:
        return None
    first = (getattr(patient, "first_name", "") or "").strip()
    last = (getattr(patient, "last_name", "") or "").strip()
    full = f"{first} {last}".strip()
    return full or getattr(patient, "uhid", None)


# ────────────────────────────────────────────────────────────────────────────
# Plan
# ────────────────────────────────────────────────────────────────────────────

class TreatmentPlanSerializer(serializers.ModelSerializer):
    hospital_id = serializers.UUIDField(read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    patient_name = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = TreatmentPlan
        fields = [
            "id",
            "hospital_id",
            "ipd_admission",
            "patient_name",
            "created_by",
            "created_by_email",
            "name",
            "notes",
            "start_date",
            "end_date",
            "status",
            "item_count",
            "created_at",
            "updated_at",
        ]

    def get_patient_name(self, obj):
        try:
            return _safe_patient_name(obj.ipd_admission.patient)
        except Exception:
            return None

    def get_item_count(self, obj):
        return obj.items.filter(is_active=True).count()


class TreatmentPlanCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreatmentPlan
        fields = ["id", "ipd_admission", "name", "notes", "start_date", "end_date", "status"]
        read_only_fields = ["id"]


# ────────────────────────────────────────────────────────────────────────────
# Plan items
# ────────────────────────────────────────────────────────────────────────────

class TreatmentPlanItemSerializer(serializers.ModelSerializer):
    assigned_staff_name = serializers.SerializerMethodField()
    assigned_designation_name = serializers.CharField(source="assigned_designation.name", read_only=True)
    assigned_department_name = serializers.CharField(source="assigned_department.name", read_only=True)
    task_count = serializers.SerializerMethodField()

    class Meta:
        model = TreatmentPlanItem
        fields = [
            "id",
            "plan",
            "parent",
            "sequence",
            "title",
            "instructions",
            "category",
            "day_offset",
            "time_of_day",
            "assigned_staff",
            "assigned_staff_name",
            "assigned_designation",
            "assigned_designation_name",
            "assigned_department",
            "assigned_department_name",
            "is_active",
            "task_count",
            "created_at",
            "updated_at",
        ]

    def get_assigned_staff_name(self, obj):
        if obj.assigned_staff:
            parts = f"{(obj.assigned_staff.first_name or '').strip()} {(obj.assigned_staff.last_name or '').strip()}".strip()
            return parts or obj.assigned_staff.employee_code or str(obj.assigned_staff.id)
        return None

    def get_task_count(self, obj):
        return obj.tasks.count()


class TreatmentPlanItemCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreatmentPlanItem
        fields = [
            "plan",
            "parent",
            "sequence",
            "title",
            "instructions",
            "category",
            "day_offset",
            "time_of_day",
            "assigned_staff",
            "assigned_designation",
            "assigned_department",
            "is_active",
        ]


# ────────────────────────────────────────────────────────────────────────────
# Tasks (what staff see and act on)
# ────────────────────────────────────────────────────────────────────────────

class TreatmentTaskSerializer(serializers.ModelSerializer):
    hospital_id = serializers.UUIDField(source="ipd_admission.hospital_id", read_only=True)
    patient_name = serializers.SerializerMethodField()
    item_title = serializers.CharField(source="plan_item.title", read_only=True)
    item_category = serializers.CharField(source="plan_item.category", read_only=True)
    bed_code = serializers.CharField(source="ipd_admission.bed_code", read_only=True)
    assigned_staff_name = serializers.SerializerMethodField()
    completed_by_email = serializers.EmailField(source="completed_by.email", read_only=True)

    class Meta:
        model = TreatmentTask
        fields = [
            "id",
            "hospital_id",
            "plan_item",
            "item_title",
            "item_category",
            "bed_code",
            "ipd_admission",
            "patient_name",
            "date",
            "time_of_day",
            "assigned_staff",
            "assigned_staff_name",
            "status",
            "priority",
            "notes_from_doctor",
            "notes_from_staff",
            "completed_at",
            "completed_by",
            "completed_by_email",
            "created_at",
            "updated_at",
        ]

    def get_patient_name(self, obj):
        try:
            return _safe_patient_name(obj.ipd_admission.patient)
        except Exception:
            return None

    def get_assigned_staff_name(self, obj):
        if obj.assigned_staff:
            parts = f"{(obj.assigned_staff.first_name or '').strip()} {(obj.assigned_staff.last_name or '').strip()}".strip()
            return parts or obj.assigned_staff.employee_code or str(obj.assigned_staff.id)
        return None


class TreatmentTaskStatusUpdateSerializer(serializers.ModelSerializer):
    """Used by staff to update task status and add notes."""

    class Meta:
        model = TreatmentTask
        fields = ["status", "priority", "notes_from_staff"]


class TreatmentPlanStaffAssignmentSerializer(serializers.ModelSerializer):
    staff_name = serializers.SerializerMethodField()
    staff_designation = serializers.CharField(source="staff.designation.name", read_only=True, default="")
    staff_department = serializers.CharField(source="staff.department.name", read_only=True, default="")

    class Meta:
        model = TreatmentPlanStaffAssignment
        fields = [
            "id",
            "plan",
            "staff",
            "staff_name",
            "staff_designation",
            "staff_department",
            "assigned_by",
            "role_label",
            "created_at",
        ]
        read_only_fields = ["id", "assigned_by", "created_at"]

    def get_staff_name(self, obj):
        if obj.staff:
            parts = f"{(obj.staff.first_name or '').strip()} {(obj.staff.last_name or '').strip()}".strip()
            return parts or obj.staff.employee_code or str(obj.staff.id)
        return None


class TreatmentPlanStaffAssignmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreatmentPlanStaffAssignment
        fields = ["plan", "staff", "role_label"]
        extra_kwargs = {
            "plan": {"required": False},
        }


class PatientPlanOverviewSerializer(serializers.Serializer):
    """Read-only overview for patient selection grid."""
    admission_id = serializers.UUIDField()
    patient_id = serializers.UUIDField()
    patient_name = serializers.CharField()
    uhid = serializers.CharField()
    admission_type = serializers.CharField()
    plan_status = serializers.CharField()
    plan_count = serializers.IntegerField()
    assigned_staff_count = serializers.IntegerField()
    assigned_staff_names = serializers.ListField(child=serializers.CharField())


class PatientTimelineSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    treatment_item_title = serializers.CharField(source="treatment_item.title", read_only=True)

    class Meta:
        model = PatientTimeline
        fields = [
            "id",
            "patient",
            "patient_name",
            "ipd_admission",
            "event_type",
            "title",
            "description",
            "timestamp",
            "treatment_plan",
            "treatment_item",
            "treatment_item_title",
            "treatment_task",
        ]

    def get_patient_name(self, obj):
        try:
            return _safe_patient_name(obj.patient)
        except Exception:
            return None


class TreatmentTemplateCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreatmentTemplateCatalog
        fields = ["id", "hospital", "templates", "packages", "updated_by", "updated_at"]
        read_only_fields = ["id", "hospital", "updated_by", "updated_at"]
