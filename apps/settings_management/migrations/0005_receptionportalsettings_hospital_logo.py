from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("settings_management", "0004_receptionportalsettings_opd_fee_mode_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="receptionportalsettings",
            name="hospital_logo",
            field=models.ImageField(blank=True, null=True, upload_to="hospital_logos/"),
        ),
    ]
