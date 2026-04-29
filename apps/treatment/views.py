from __future__ import annotations

from django.db.models import Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from rest_framework.views import APIView

from apps.roles_permissions.permissions import HasRequiredPermission
from apps.treatment.models import (
    PatientTimeline,
    TreatmentPlan,
    TreatmentPlanItem,
    TreatmentPlanStaffAssignment,
    TreatmentTask,
    TreatmentTemplateCatalog,
)
from apps.treatment.serializers import (
    PatientTimelineSerializer,
    TreatmentPlanCreateUpdateSerializer,
    TreatmentPlanItemCreateUpdateSerializer,
    TreatmentPlanItemSerializer,
    TreatmentPlanSerializer,
    TreatmentPlanStaffAssignmentCreateSerializer,
    TreatmentPlanStaffAssignmentSerializer,
    TreatmentTaskSerializer,
    TreatmentTaskStatusUpdateSerializer,
    TreatmentTemplateCatalogSerializer,
)
from apps.treatment.services import (
    cancel_plan,
    complete_task,
    create_patient_timeline_event,
    generate_tasks_for_plan,
)


class HospitalScopedMixin:
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return qs
        if not getattr(user, "hospital_id", None):
            return qs.none()
        return qs.filter(hospital_id=user.hospital_id)


# ────────────────────────────────────────────────────────────────────────────
# TreatmentPlan
# ────────────────────────────────────────────────────────────────────────────

class TreatmentPlanViewSet(HospitalScopedMixin, viewsets.ModelViewSet):
    """
    CRUD for treatment plans.
    After creating or updating a plan, call the /generate-tasks/ action to
    materialise TreatmentTask rows for staff.
    """

    queryset = TreatmentPlan.objects.all().select_related(
        "ipd_admission", "ipd_admission__patient", "created_by"
    )
    filter_backends = (DjangoFilterBackend, SearchFilter, OrderingFilter)
    filterset_fields = ("ipd_admission", "status")
    search_fields = ("name", "notes", "ipd_admission__patient__first_name")
    ordering_fields = ("start_date", "created_at", "status")
    ordering = ("-created_at",)

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return TreatmentPlanSerializer
        return TreatmentPlanCreateUpdateSerializer

    def perform_create(self, serializer):
        user = self.request.user
        plan = serializer.save(
            hospital_id=user.hospital_id,
            created_by=user,
        )
        generate_tasks_for_plan(plan, plan.start_date, plan.end_date or plan.start_date)
        create_patient_timeline_event(
            patient=plan.ipd_admission.patient,
            hospital_id=plan.hospital_id,
            ipd_admission=plan.ipd_admission,
            event_type=PatientTimeline.EventType.PLAN_SAVED,
            title=f"Treatment plan saved: {plan.name or 'Treatment Plan'}",
            description=f"{plan.items.filter(is_active=True).count()} items scheduled.",
            treatment_plan=plan,
            created_by=user,
        )

        from apps.notifications.helpers import notify_treatment_assigned
        for sa in plan.staff_assignments.select_related("staff__user").all():
            staff_user = getattr(sa.staff, "user", None)
            if staff_user:
                patient_name = ""
                try:
                    patient_name = plan.ipd_admission.patient.first_name
                except Exception:
                    pass
                notify_treatment_assigned(
                    hospital_id=plan.hospital_id,
                    recipient=staff_user,
                    patient_name=patient_name,
                    plan_name=plan.name or "Unnamed Plan",
                    plan_id=plan.id,
                )

    def perform_update(self, serializer):
        plan = serializer.save()
        generate_tasks_for_plan(plan, plan.start_date, plan.end_date or plan.start_date)
        create_patient_timeline_event(
            patient=plan.ipd_admission.patient,
            hospital_id=plan.hospital_id,
            ipd_admission=plan.ipd_admission,
            event_type=PatientTimeline.EventType.PLAN_SAVED,
            title=f"Treatment plan saved: {plan.name or 'Treatment Plan'}",
            description=f"{plan.items.filter(is_active=True).count()} items scheduled.",
            treatment_plan=plan,
            created_by=self.request.user,
        )

        from apps.notifications.helpers import notify_treatment_updated
        for sa in plan.staff_assignments.select_related("staff__user").all():
            staff_user = getattr(sa.staff, "user", None)
            if staff_user:
                patient_name = ""
                try:
                    patient_name = plan.ipd_admission.patient.first_name
                except Exception:
                    pass
                notify_treatment_updated(
                    hospital_id=plan.hospital_id,
                    recipient=staff_user,
                    patient_name=patient_name,
                    plan_name=plan.name or "Unnamed Plan",
                    plan_id=plan.id,
                )

    @action(detail=True, methods=["post"], url_path="generate-tasks")
    def generate_tasks(self, request, pk=None):
        """
        Manually trigger task generation for this plan.
        Accepts optional body: { "from_date": "YYYY-MM-DD", "to_date": "YYYY-MM-DD" }
        """
        plan = self.get_object()
        from_date_str = request.data.get("from_date")
        to_date_str = request.data.get("to_date")

        from datetime import date as dt_date
        from_date = dt_date.fromisoformat(from_date_str) if from_date_str else plan.start_date
        to_date = dt_date.fromisoformat(to_date_str) if to_date_str else (plan.end_date or plan.start_date)

        count = generate_tasks_for_plan(plan, from_date, to_date)
        return Response({"tasks_created": count})

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Cancel the plan and all pending tasks under it."""
        plan = self.get_object()
        cancel_plan(plan=plan, cancelled_by=request.user)
        return Response({"detail": "Plan cancelled."})

    @action(detail=True, methods=["post"], url_path="lock")
    def lock(self, request, pk=None):
        """Lock plan and notify all assigned staff."""
        plan = self.get_object()
        if plan.status not in (TreatmentPlan.Status.ACTIVE,):
            return Response({"detail": f"Cannot lock plan with status '{plan.status}'."}, status=status.HTTP_400_BAD_REQUEST)
        plan.status = TreatmentPlan.Status.LOCKED
        plan.save(update_fields=["status", "updated_at"])

        from apps.notifications.helpers import notify_treatment_assigned
        for sa in plan.staff_assignments.select_related("staff__user").all():
            staff_user = getattr(sa.staff, "user", None)
            if staff_user:
                patient_name = ""
                try:
                    patient_name = plan.ipd_admission.patient.first_name
                except Exception:
                    pass
                notify_treatment_assigned(
                    hospital_id=plan.hospital_id,
                    recipient=staff_user,
                    patient_name=patient_name,
                    plan_name=plan.name or "Treatment Plan",
                    plan_id=plan.id,
                )
        return Response({"detail": "Plan locked and staff notified.", "status": plan.status})

    @action(detail=True, methods=["post"], url_path="unlock")
    def unlock(self, request, pk=None):
        """Unlock a locked plan for editing."""
        plan = self.get_object()
        if plan.status != TreatmentPlan.Status.LOCKED:
            return Response({"detail": f"Plan is not locked (status: '{plan.status}')."}, status=status.HTTP_400_BAD_REQUEST)
        plan.status = TreatmentPlan.Status.ACTIVE
        plan.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Plan unlocked for editing.", "status": plan.status})

    @action(detail=True, methods=["get", "post"], url_path="staff-assignments")
    def staff_assignments(self, request, pk=None):
        """GET: list staff assigned to this plan. POST: assign a staff member."""
        plan = self.get_object()
        if request.method == "GET":
            qs = TreatmentPlanStaffAssignment.objects.filter(plan=plan).select_related(
                "staff", "staff__designation", "staff__department"
            )
            return Response(TreatmentPlanStaffAssignmentSerializer(qs, many=True).data)

        ser = TreatmentPlanStaffAssignmentCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        assignment = ser.save(plan=plan, assigned_by=request.user)

        from apps.notifications.helpers import notify_treatment_assigned
        staff_user = getattr(assignment.staff, "user", None)
        if staff_user:
            patient_name = ""
            try:
                patient_name = plan.ipd_admission.patient.first_name
            except Exception:
                pass
            notify_treatment_assigned(
                hospital_id=plan.hospital_id,
                recipient=staff_user,
                patient_name=patient_name,
                plan_name=plan.name or "Unnamed Plan",
                plan_id=plan.id,
            )

        return Response(
            TreatmentPlanStaffAssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["delete"], url_path="staff-assignments/(?P<assignment_pk>[^/.]+)")
    def remove_staff_assignment(self, request, pk=None, assignment_pk=None):
        plan = self.get_object()
        try:
            assignment = TreatmentPlanStaffAssignment.objects.get(pk=assignment_pk, plan=plan)
        except TreatmentPlanStaffAssignment.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        assignment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ────────────────────────────────────────────────────────────────────────────
# TreatmentPlanItem
# ────────────────────────────────────────────────────────────────────────────

class TreatmentPlanItemViewSet(viewsets.ModelViewSet):
    """
    CRUD for individual items (medications, nursing tasks, etc.) inside a plan.
    Filtered by plan via query param ?plan=<uuid>.
    """

    queryset = TreatmentPlanItem.objects.all().select_related(
        "plan", "assigned_staff", "assigned_designation", "assigned_department", "parent"
    )
    filter_backends = (DjangoFilterBackend, SearchFilter, OrderingFilter)
    filterset_fields = ("plan", "category", "day_offset", "is_active")
    search_fields = ("title", "instructions")
    ordering_fields = ("day_offset", "time_of_day", "sequence")
    ordering = ("day_offset", "time_of_day", "sequence")

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    def get_serializer_class(self):
        if self.action in {"list", "retrieve"}:
            return TreatmentPlanItemSerializer
        return TreatmentPlanItemCreateUpdateSerializer

    def perform_create(self, serializer):
        item = serializer.save()
        # Auto-generate the task for this specific item.
        plan = item.plan
        task_date = plan.start_date
        from datetime import timedelta
        task_date = plan.start_date + timedelta(days=item.day_offset)
        generate_tasks_for_plan(plan, task_date, task_date)

    def perform_update(self, serializer):
        item = serializer.save()
        # Regenerate task for updated item (only if still pending).
        plan = item.plan
        from datetime import timedelta
        task_date = plan.start_date + timedelta(days=item.day_offset)
        generate_tasks_for_plan(plan, task_date, task_date)


# ────────────────────────────────────────────────────────────────────────────
# TreatmentTask
# ────────────────────────────────────────────────────────────────────────────

class TreatmentTaskViewSet(viewsets.ModelViewSet):
    """
    Readable by all staff; status updates by the assigned staff member.
    Supports:
      - ?date=YYYY-MM-DD  filter by date
      - ?assigned_staff=<uuid>
      - ?ipd_admission=<uuid>
      - ?status=pending / done / ...
      - ?mine=true  → only tasks assigned to the logged-in user's staff profile
    """

    queryset = TreatmentTask.objects.all().select_related(
        "plan_item",
        "plan_item__plan",
        "ipd_admission",
        "ipd_admission__patient",
        "assigned_staff",
        "completed_by",
    )
    filter_backends = (DjangoFilterBackend, SearchFilter, OrderingFilter)
    filterset_fields = ("date", "status", "priority", "assigned_staff", "ipd_admission")
    search_fields = ("plan_item__title", "ipd_admission__patient__first_name")
    ordering_fields = ("date", "time_of_day", "priority", "status")
    ordering = ("date", "time_of_day", "priority")

    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    def get_serializer_class(self):
        if self.action in {"partial_update", "update"}:
            return TreatmentTaskStatusUpdateSerializer
        return TreatmentTaskSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_superuser:
            qs = qs.filter(ipd_admission__hospital_id=user.hospital_id)

        # ?mine=true → filter to logged-in user's staff profile
        if self.request.query_params.get("mine") == "true":
            from apps.staff.models import StaffProfile
            staff = StaffProfile.objects.filter(
                user=user, is_deleted=False
            ).first()
            if staff:
                qs = qs.filter(
                    Q(assigned_staff=staff)
                    | Q(assigned_staff__isnull=True, plan_item__plan__staff_assignments__staff=staff)
                ).distinct()
            else:
                qs = qs.none()

        return qs

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        """Mark task as done with optional staff notes."""
        task = self.get_object()
        notes = request.data.get("notes", "")
        try:
            complete_task(task=task, completed_by=request.user, notes=notes)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(TreatmentTaskSerializer(task, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="skip")
    def skip(self, request, pk=None):
        """Mark task as skipped."""
        task = self.get_object()
        if task.status in (TreatmentTask.Status.DONE, TreatmentTask.Status.CANCELLED):
            return Response(
                {"detail": f"Task is already {task.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        task.status = TreatmentTask.Status.SKIPPED
        task.notes_from_staff = request.data.get("notes", task.notes_from_staff)
        task.save(update_fields=["status", "notes_from_staff", "updated_at"])
        create_patient_timeline_event(
            patient=task.ipd_admission.patient,
            hospital_id=task.ipd_admission.hospital_id,
            ipd_admission=task.ipd_admission,
            event_type=PatientTimeline.EventType.TREATMENT_SKIPPED,
            title=f"{task.plan_item.title} skipped",
            description=task.notes_from_staff or "Treatment task marked as skipped.",
            treatment_plan=task.plan_item.plan,
            treatment_item=task.plan_item,
            treatment_task=task,
            created_by=request.user,
        )
        return Response(TreatmentTaskSerializer(task, context={"request": request}).data)


class PatientTimelineViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only patient timeline for treatment audit history.
    Supports:
      - ?patient=<uuid>
      - ?ipd_admission=<uuid>
    """

    queryset = PatientTimeline.objects.all().select_related(
        "patient",
        "ipd_admission",
        "treatment_plan",
        "treatment_item",
        "treatment_task",
    )
    serializer_class = PatientTimelineSerializer
    filter_backends = (DjangoFilterBackend, OrderingFilter)
    filterset_fields = ("patient", "ipd_admission", "event_type")
    ordering_fields = ("timestamp", "created_at")
    ordering = ("-timestamp", "-created_at")
    permission_classes = [permissions.IsAuthenticated, HasRequiredPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return qs
        return qs.filter(hospital_id=user.hospital_id)


class PatientPlanOverviewView(APIView):
    """GET /api/v1/treatment/patient-overview/ — patient cards for treatment plan module."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        from django.db.models import Count, Q
        from apps.ipd.models import IPDAdmission

        hid = getattr(request.user, "hospital_id", None)
        if not hid and not request.user.is_superuser:
            # Avoid noisy 400s when frontend briefly calls before auth/user hydration.
            return Response([])

        admissions_qs = IPDAdmission.objects.filter(status="admitted")
        if not request.user.is_superuser:
            admissions_qs = admissions_qs.filter(hospital_id=hid)
        admissions = admissions_qs.select_related("patient").order_by("-created_at")

        results = []
        for adm in admissions:
            plans = TreatmentPlan.objects.filter(ipd_admission=adm)
            plan_count = plans.count()
            active_plans = plans.filter(status=TreatmentPlan.Status.ACTIVE)

            if active_plans.exists():
                plan_status = "Active"
            elif plans.filter(status=TreatmentPlan.Status.COMPLETED).exists():
                plan_status = "Completed"
            else:
                plan_status = "No Plan"

            staff_ids = set()
            staff_names = []
            for p in active_plans:
                for sa in p.staff_assignments.select_related("staff").all():
                    if sa.staff_id not in staff_ids:
                        staff_ids.add(sa.staff_id)
                        name = f"{(sa.staff.first_name or '').strip()} {(sa.staff.last_name or '').strip()}".strip()
                        staff_names.append(name or sa.staff.employee_code or str(sa.staff_id))

            patient = adm.patient
            results.append({
                "admission_id": str(adm.id),
                "patient_id": str(patient.id),
                "patient_name": f"{patient.first_name} {patient.last_name}".strip(),
                "uhid": patient.uhid,
                "admission_type": "IPD",
                "plan_status": plan_status,
                "plan_count": plan_count,
                "assigned_staff_count": len(staff_ids),
                "assigned_staff_names": staff_names,
            })

        return Response(results)


class TreatmentTemplateCatalogView(APIView):
    """GET/PUT /api/v1/treatment/template-package-catalog/"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        hid = getattr(request.user, "hospital_id", None)
        if not hid and not request.user.is_superuser:
            return Response({"templates": [], "packages": []})
        catalog = TreatmentTemplateCatalog.objects.filter(hospital_id=hid).first()
        if not catalog:
            return Response({"templates": [], "packages": []})
        return Response(TreatmentTemplateCatalogSerializer(catalog).data)

    def put(self, request, *args, **kwargs):
        hid = getattr(request.user, "hospital_id", None)
        if not hid and not request.user.is_superuser:
            return Response({"detail": "User hospital context required."}, status=status.HTTP_400_BAD_REQUEST)

        templates = request.data.get("templates", [])
        packages = request.data.get("packages", [])
        if not isinstance(templates, list) or not isinstance(packages, list):
            return Response(
                {"detail": "Both 'templates' and 'packages' must be arrays."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        catalog, _ = TreatmentTemplateCatalog.objects.get_or_create(
            hospital_id=hid,
            defaults={"templates": templates, "packages": packages, "updated_by": request.user},
        )
        catalog.templates = templates
        catalog.packages = packages
        catalog.updated_by = request.user
        catalog.save(update_fields=["templates", "packages", "updated_by", "updated_at"])
        return Response(TreatmentTemplateCatalogSerializer(catalog).data)
