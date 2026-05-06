from datetime import date

from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from apps.patients.models import Patient, PatientAddress, PatientGuardian


class PatientSerializer(serializers.ModelSerializer):
    """Read serializer — includes flat address + computed age for receptionist UIs."""

    address_line1 = serializers.SerializerMethodField()
    city = serializers.SerializerMethodField()
    state = serializers.SerializerMethodField()
    guardian_name = serializers.SerializerMethodField()
    guardian_relationship = serializers.SerializerMethodField()
    age = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            "id",
            "uhid",
            "status",
            "patient_type",
            "first_name",
            "middle_name",
            "last_name",
            "gender",
            "dob",
            "preferred_salutation",
            "age",
            "phone",
            "email",
            "blood_group",
            "registration_note",
            "emergency_tags",
            "family_group_id",
            "hospital_id",
            "address_line1",
            "city",
            "state",
            "guardian_name",
            "guardian_relationship",
            "created_at",
            "updated_at",
        ]

    def _addr(self, obj):
        try:
            return obj.address
        except ObjectDoesNotExist:
            return None

    def get_address_line1(self, obj):
        a = self._addr(obj)
        return a.line1 if a else ""

    def get_city(self, obj):
        a = self._addr(obj)
        return a.city if a else ""

    def get_state(self, obj):
        a = self._addr(obj)
        return a.state if a else ""

    def get_guardian_name(self, obj):
        try:
            return obj.guardian.name
        except ObjectDoesNotExist:
            return ""

    def get_guardian_relationship(self, obj):
        try:
            return (obj.guardian.relationship or "").strip()
        except ObjectDoesNotExist:
            return ""

    def get_age(self, obj):
        if not obj.dob:
            return None
        today = date.today()
        y = today.year - obj.dob.year
        if (today.month, today.day) < (obj.dob.month, obj.dob.day):
            y -= 1
        return y


class PatientCreateUpdateSerializer(serializers.ModelSerializer):
    hospital_id = serializers.UUIDField(read_only=True)
    # Address convenience fields (write-only, saved to PatientAddress after create)
    address_line1 = serializers.CharField(write_only=True, required=False, allow_blank=True, default="")
    city          = serializers.CharField(write_only=True, required=False, allow_blank=True, default="")
    state         = serializers.CharField(write_only=True, required=False, allow_blank=True, default="")
    guardian_name = serializers.CharField(write_only=True, required=False, allow_blank=True, default="")
    guardian_relationship = serializers.CharField(write_only=True, required=False, allow_blank=True)
    preferred_salutation = serializers.CharField(required=False, allow_blank=True, default="")
    age           = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    # last_name is optional — single-name patients are valid
    last_name = serializers.CharField(required=False, allow_blank=True, default="")
    # When true on create: link this patient with others sharing the same mobile (patient.phone or guardian.phone).
    link_with_existing_phone_patients = serializers.BooleanField(
        write_only=True, required=False, default=False
    )

    class Meta:
        model = Patient
        fields = [
            "uhid",
            "status",
            "patient_type",
            "first_name",
            "middle_name",
            "last_name",
            "gender",
            "dob",
            "preferred_salutation",
            "age",
            "phone",
            "email",
            "blood_group",
            "registration_note",
            "emergency_tags",
            "family_group_id",
            "hospital_id",
            "address_line1",
            "city",
            "state",
            "guardian_name",
            "guardian_relationship",
            "link_with_existing_phone_patients",
        ]

    def validate(self, attrs):
        hospital = self.context.get("hospital")
        uhid = attrs.get("uhid")
        if hospital and uhid:
            qs = Patient.objects.filter(hospital=hospital, uhid=uhid)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"uhid": ["UHID already exists for this hospital."]})
        return attrs

    def _pop_write_only_extras(self, validated_data: dict):
        """Remove non-Patient keys; return (age, address parts, guardian) for side effects."""
        age = validated_data.pop("age", None)
        address_line1 = validated_data.pop("address_line1", None)
        city = validated_data.pop("city", None)
        state = validated_data.pop("state", None)
        guardian_name = validated_data.pop("guardian_name", None)
        guardian_relationship = validated_data.pop("guardian_relationship", None)
        return age, address_line1, city, state, guardian_name, guardian_relationship

    def create(self, validated_data):
        age, al, ct, st, gn, gr = self._pop_write_only_extras(validated_data)
        link = validated_data.pop("link_with_existing_phone_patients", False)
        patient = super().create(validated_data)

        # Handle writing extras if provided during create
        if age is not None:
            from datetime import date
            try:
                patient.dob = date(date.today().year - int(age), 1, 1)
                patient.save(update_fields=["dob"])
            except (ValueError, TypeError):
                pass

        if any(v is not None for v in (al, ct, st)):
            PatientAddress.objects.create(
                patient=patient,
                line1=al or "",
                city=ct or "",
                state=st or "",
            )

        # Avoid creating an empty guardian row when both name and relationship are blank.
        if ((gn or "").strip()) or (gr is not None and (gr or "").strip()):
            PatientGuardian.objects.create(
                patient=patient,
                name=(gn or "").strip(),
                relationship=(gr or "").strip() if gr is not None else "",
            )

        if link:
            from apps.patients.services.phone_family import ensure_family_group_for_shared_phone

            ensure_family_group_for_shared_phone(patient)
            patient.refresh_from_db()
        return patient

    def update(self, instance, validated_data):
        validated_data.pop("link_with_existing_phone_patients", None)
        age, al, ct, st, gn, gr = self._pop_write_only_extras(validated_data)
        if age is not None:
            try:
                validated_data["dob"] = date(date.today().year - int(age), 1, 1)
            except (ValueError, TypeError):
                pass
        inst = super().update(instance, validated_data)
        if any(v is not None for v in (al, ct, st)):
            addr, _ = PatientAddress.objects.get_or_create(
                patient=inst,
                defaults={"line1": "", "city": "", "state": ""},
            )
            if al is not None:
                addr.line1 = al
            if ct is not None:
                addr.city = ct
            if st is not None:
                addr.state = st
            addr.save()

        if gn is not None or gr is not None:
            g, _ = PatientGuardian.objects.get_or_create(
                patient=inst,
                defaults={"name": "", "relationship": ""},
            )
            if gn is not None:
                g.name = gn
            if gr is not None:
                g.relationship = (gr or "").strip()
            g.save()

        return inst

