from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('discharge', '0005_dischargesurgery'),
    ]

    operations = [
        migrations.AddField(
            model_name='dischargesummary',
            name='is_draft',
            field=models.BooleanField(default=True),
        ),
    ]
