from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pharmacy", "0019_pharmacyinvoice_print_html"),
        ("staff", "0007_designation_allowed_portals"),
    ]

    operations = [
        migrations.AddField(
            model_name="staffprofile",
            name="allowed_pharmacies",
            field=models.ManyToManyField(
                blank=True,
                related_name="allowed_staff",
                to="pharmacy.pharmacy",
            ),
        ),
    ]
