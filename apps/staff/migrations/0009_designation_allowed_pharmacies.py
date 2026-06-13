from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pharmacy", "0019_pharmacyinvoice_print_html"),
        ("staff", "0008_staffprofile_allowed_pharmacies"),
    ]

    operations = [
        migrations.AddField(
            model_name="designation",
            name="allowed_pharmacies",
            field=models.ManyToManyField(
                blank=True,
                related_name="designations_with_access",
                to="pharmacy.pharmacy",
            ),
        ),
    ]
