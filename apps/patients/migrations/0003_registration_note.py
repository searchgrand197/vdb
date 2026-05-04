# Generated manually for registration_note on Patient

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("patients", "0002_make_last_name_optional"),
    ]

    operations = [
        migrations.AddField(
            model_name="patient",
            name="registration_note",
            field=models.TextField(blank=True, default=""),
        ),
    ]
