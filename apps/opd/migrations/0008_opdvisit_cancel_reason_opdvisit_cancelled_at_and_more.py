from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("opd", "0007_opdvisit_opd_no_opdvisitsequence"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="opdvisit",
            name="cancel_reason",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="opdvisit",
            name="cancelled_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="opdvisit",
            name="cancelled_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="opd_visits_cancelled",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
