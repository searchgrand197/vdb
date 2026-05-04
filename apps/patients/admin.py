from django.contrib import admin

from .models import (
    Allergy,
    ChronicDisease,
    EmergencyContact,
    Patient,
    PatientActivity,
    PatientAddress,
    PatientFamilyGroup,
    PatientGuardian,
    PatientTag,
    PatientTagAssignment,
    UHIDSequence,
)


@admin.register(UHIDSequence)
class UHIDSequenceAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "year", "last_seq", "created_at", "updated_at")


@admin.register(PatientFamilyGroup)
class PatientFamilyGroupAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "created_at")


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ("id", "uhid", "first_name", "last_name", "phone", "hospital", "status", "is_deleted")
    list_filter = ("hospital", "status", "gender", "is_deleted")
    search_fields = ("uhid", "first_name", "last_name", "phone")


@admin.register(PatientAddress)
class PatientAddressAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "city", "state")


@admin.register(PatientGuardian)
class PatientGuardianAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "name")


@admin.register(EmergencyContact)
class PatientEmergencyContactAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "name", "phone")


@admin.register(PatientTag)
class PatientTagAdmin(admin.ModelAdmin):
    list_display = ("id", "hospital", "name")


@admin.register(PatientTagAssignment)
class PatientTagAssignmentAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "tag")


@admin.register(Allergy)
class AllergyAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "allergy", "severity", "is_deleted")


@admin.register(ChronicDisease)
class ChronicDiseaseAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "disease", "diagnosis_date", "is_deleted")


@admin.register(PatientActivity)
class PatientActivityAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "activity_type", "created_at", "is_deleted")
