from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ipd", "0004_ipdadmission_room_rent_override"),
    ]

    operations = [
        migrations.AddField(
            model_name="ipdadmission",
            name="room_rent_daily_charge_override",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
    ]
