from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("settings_management", "0016_receptionportalsettings_reception_collection_enabled"),
    ]

    operations = [
        migrations.AddField(
            model_name="receptionportalsettings",
            name="reception_daily_report_enabled",
            field=models.BooleanField(
                default=True,
                help_text="When enabled, reception staff see Daily Report. When disabled, it is admin-only.",
            ),
        ),
    ]
