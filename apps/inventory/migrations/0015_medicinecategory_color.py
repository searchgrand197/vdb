from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0014_alter_medicinecategory_unique_together"),
        ("pharmacy", "0012_pharmacy_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="medicinecategory",
            name="color",
            field=models.CharField(blank=True, default="", max_length=7),
        ),
    ]
