from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ipd", "0007_ipdadmission_room_rent_description_override"),
    ]

    operations = [
        migrations.AddField(
            model_name="ipdadmission",
            name="room_rent_days_override",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
