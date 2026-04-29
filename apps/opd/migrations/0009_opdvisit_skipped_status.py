from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("opd", "0008_opdvisit_cancel_reason_opdvisit_cancelled_at_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="opdvisit",
            name="status",
            field=models.CharField(
                choices=[
                    ("waiting", "Waiting"),
                    ("in_progress", "In Progress"),
                    ("completed", "Completed"),
                    ("skipped", "Skipped"),
                    ("cancelled", "Cancelled"),
                ],
                db_index=True,
                default="waiting",
                max_length=20,
            ),
        ),
    ]
