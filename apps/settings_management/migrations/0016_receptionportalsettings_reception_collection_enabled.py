from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("settings_management", "0015_receptionportalsettings_document_number_formats"),
    ]

    operations = [
        migrations.AddField(
            model_name="receptionportalsettings",
            name="reception_collection_enabled",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "When enabled, reception staff use shift collection and handover. "
                    "When disabled, collections are viewed only on the admin cash collection page."
                ),
            ),
        ),
    ]
