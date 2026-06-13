from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("opd", "0010_opdvisit_patient_notes"),
    ]

    operations = [
        migrations.AddField(
            model_name="opdvisit",
            name="department",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
    ]
