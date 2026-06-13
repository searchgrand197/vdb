from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("settings_management", "0006_receptionportalsettings_invoice_config"),
    ]

    operations = [
        migrations.AddField(
            model_name="receptionportalsettings",
            name="opd_visible_fields",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="List of field keys hidden in the Create OPD form. Empty list means all fields are visible.",
            ),
        ),
    ]
