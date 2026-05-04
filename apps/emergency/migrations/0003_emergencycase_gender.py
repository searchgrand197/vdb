from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("emergency", "0002_rename_emergency_e_hospit_5fdf22_idx_emergency_e_hospita_a1834f_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="emergencycase",
            name="gender",
            field=models.CharField(
                blank=True,
                choices=[("male", "Male"), ("female", "Female"), ("other", "Other")],
                default="other",
                max_length=10,
            ),
        ),
    ]
