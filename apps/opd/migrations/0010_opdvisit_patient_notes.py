from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("opd", "0009_opdvisit_skipped_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="opdvisit",
            name="patient_notes",
            field=models.JSONField(blank=True, default=list),
        ),
    ]

