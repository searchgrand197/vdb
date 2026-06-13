from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("settings_management", "0011_merge_20260511_2329"),
    ]

    operations = [
        migrations.AddField(
            model_name="receptionportalsettings",
            name="uhid_prefix",
            field=models.CharField(blank=True, default="DEF", max_length=8),
        ),
    ]
