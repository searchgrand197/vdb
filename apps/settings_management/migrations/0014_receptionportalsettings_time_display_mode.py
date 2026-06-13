from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("settings_management", "0013_receptionportalsettings_admission_bed_label_mode"),
    ]

    operations = [
        migrations.AddField(
            model_name="receptionportalsettings",
            name="time_display_mode",
            field=models.CharField(
                choices=[("12h", "12 hour"), ("24h", "24 hour")],
                default="24h",
                help_text="Hospital-wide time display: 12 hour or 24 hour.",
                max_length=4,
            ),
        ),
    ]
