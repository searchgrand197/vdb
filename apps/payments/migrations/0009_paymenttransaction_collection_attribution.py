from django.conf import settings
from django.db import migrations, models


def backfill_payment_attribution(apps, schema_editor):
    PaymentTransaction = apps.get_model("payments", "PaymentTransaction")
    for payment in PaymentTransaction.objects.select_related("invoice").iterator():
        invoice = payment.invoice
        if not invoice:
            continue
        payment.attribution_type = getattr(invoice, "attribution_type", "hospital_self")
        payment.attributed_doctor_user_id = getattr(invoice, "attributed_doctor_user_id", None)
        payment.save(update_fields=["attribution_type", "attributed_doctor_user_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0008_paymentquickcategory"),
        ("billing", "0003_billinginvoice_collection_attribution"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="paymenttransaction",
            name="attribution_type",
            field=models.CharField(
                choices=[("doctor", "Doctor"), ("hospital_self", "Self (Hospital)")],
                db_index=True,
                default="hospital_self",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="paymenttransaction",
            name="attributed_doctor_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="attributed_payments",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(backfill_payment_attribution, migrations.RunPython.noop),
    ]
