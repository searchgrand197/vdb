from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ipd", "0006_scheme_and_admission_scheme"),
    ]

    operations = [
        migrations.AddField(
            model_name="ipdadmission",
            name="room_rent_description_override",
            field=models.CharField(blank=True, default="", max_length=300),
        ),
    ]
