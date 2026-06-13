from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("patients", "0004_patient_preferred_salutation"),
    ]

    operations = [
        migrations.AddField(
            model_name="patient",
            name="opd_custom_fields",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
