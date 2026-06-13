from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("staff", "0006_master_soft_delete"),
    ]

    operations = [
        migrations.AddField(
            model_name="designation",
            name="allowed_portals",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
