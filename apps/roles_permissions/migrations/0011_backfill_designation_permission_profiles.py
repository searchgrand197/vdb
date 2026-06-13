from django.db import migrations


def create_missing_designation_profiles(apps, schema_editor):
    Designation = apps.get_model("staff", "Designation")
    DesignationPermissionProfile = apps.get_model("roles_permissions", "DesignationPermissionProfile")

    for designation in Designation.objects.all().iterator():
        DesignationPermissionProfile.objects.get_or_create(designation_id=designation.id)


class Migration(migrations.Migration):
    dependencies = [
        ("roles_permissions", "0010_remove_userrole"),
        ("staff", "0006_master_soft_delete"),
    ]

    operations = [
        migrations.RunPython(create_missing_designation_profiles, migrations.RunPython.noop),
    ]
