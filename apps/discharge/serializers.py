from rest_framework import serializers
from apps.discharge.models import DischargeSummary

class DischargeSummarySerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    patient_uhid = serializers.CharField(source="admission.patient.uhid", read_only=True)
    admission_date = serializers.DateField(source="admission.admission_date", read_only=True)

    class Meta:
        model = DischargeSummary
        fields = [
            "id",
            "admission",
            "hospital",
            "patient_name",
            "patient_uhid",
            "admission_date",
            "summary_notes",
            "treatment_given",
            "condition_at_discharge",
            "medications_on_discharge",
            "follow_up_advice",
            "reason_for_admission",
            "diagnosis",
            "allergies",
            "procedure_surgery",
            "medical_history",
            "physical_examination",
            "investigations",
            "course_in_hospital",
            "diet_advice",
            "activity_advice",
            "warning_signs",
            "total_billed",
            "total_paid",
            "outstanding_balance",
            "created_at",
        ]
        read_only_fields = ["hospital"]

    def get_patient_name(self, obj):
        if obj.admission and obj.admission.patient:
            parts = [obj.admission.patient.first_name, obj.admission.patient.last_name]
            name = " ".join(filter(None, parts)).strip()
            return name or obj.admission.patient.uhid
        return ""


