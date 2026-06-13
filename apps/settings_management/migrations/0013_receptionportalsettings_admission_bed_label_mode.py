from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("settings_management", "0012_receptionportalsettings_uhid_prefix"),
    ]

    operations = [
        migrations.AddField(
            model_name="receptionportalsettings",
            name="admission_bed_label_mode",
            field=models.CharField(
                choices=[("bed_code", "Bed code"), ("bed_number", "Bed number")],
                default="bed_code",
                help_text="Label shown in admission bed picker: bed code or bed number.",
                max_length=20,
            ),
        ),
    ]
