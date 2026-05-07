from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("settings_management", "0005_receptionportalsettings_hospital_logo"),
    ]

    operations = [
        migrations.AddField(
            model_name="receptionportalsettings",
            name="invoice_next_number",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="receptionportalsettings",
            name="invoice_prefix",
            field=models.CharField(blank=True, default="INV", max_length=20),
        ),
    ]
