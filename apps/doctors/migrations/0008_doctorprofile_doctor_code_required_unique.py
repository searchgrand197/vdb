from collections import defaultdict

from django.db import migrations, models


def fix_doctor_codes_for_uniqueness(apps, schema_editor):
    DoctorProfile = apps.get_model("doctors", "DoctorProfile")

    for d in DoctorProfile.objects.filter(is_deleted=False).iterator():
        if not (d.doctor_code or "").strip():
            short = str(d.pk).replace("-", "")[:12].upper()
            d.doctor_code = f"AUTO-{short}"
            d.save(update_fields=["doctor_code"])

    active = list(DoctorProfile.objects.filter(is_deleted=False).order_by("pk"))
    groups = defaultdict(list)
    for d in active:
        code = (d.doctor_code or "").strip()
        if not code:
            continue
        groups[(d.hospital_id, code.lower())].append(d)

    for _key, members in groups.items():
        if len(members) < 2:
            continue
        for d in members[1:]:
            base = (members[0].doctor_code or "").strip()
            suffix = str(d.pk).replace("-", "")[:10].upper()
            new_code = f"{base}-{suffix}"
            if len(new_code) > 80:
                new_code = new_code[:80]
            d.doctor_code = new_code
            d.save(update_fields=["doctor_code"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("doctors", "0007_doctorportalpreference_dosage_pattern_options_and_more"),
    ]

    operations = [
        migrations.RunPython(fix_doctor_codes_for_uniqueness, noop_reverse),
        migrations.AlterField(
            model_name="doctorprofile",
            name="doctor_code",
            field=models.CharField(max_length=80),
        ),
        migrations.AddConstraint(
            model_name="doctorprofile",
            constraint=models.UniqueConstraint(
                fields=("hospital", "doctor_code"),
                condition=models.Q(is_deleted=False),
                name="doctorprofile_hospital_active_doctor_code_uniq",
            ),
        ),
    ]
