# Manual IPD room rent total override (ledger editable)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ipd", "0003_ipdadmission_ipd_no_ipdadmissionsequence"),
    ]

    operations = [
        migrations.AddField(
            model_name="ipdadmission",
            name="room_rent_override",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
    ]
