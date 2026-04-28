from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("shared", "0002_add_pharmacy_branch_fields_to_hospital"),
        ("treatment", "0004_rename_treatment_p_hospita_abf9ec_idx_treatment_p_hospita_df1293_idx_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TreatmentTemplateCatalog",
            fields=[
                ("created_at", models.DateTimeField(default=django.utils.timezone.now, editable=False)),
                ("updated_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("templates", models.JSONField(blank=True, default=list)),
                ("packages", models.JSONField(blank=True, default=list)),
                (
                    "hospital",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="treatment_template_catalog",
                        to="shared.hospital",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="updated_treatment_template_catalogs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [models.Index(fields=["hospital"], name="treatment_t_hospita_5d87d0_idx")],
            },
        ),
    ]
