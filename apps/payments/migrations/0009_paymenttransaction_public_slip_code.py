from django.db import migrations, models
from django.utils.crypto import get_random_string


def backfill_public_slip_codes(apps, schema_editor):
    PaymentTransaction = apps.get_model("payments", "PaymentTransaction")
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    seen = set(
        PaymentTransaction.objects.exclude(public_slip_code="").values_list("public_slip_code", flat=True)
    )
    for payment in PaymentTransaction.objects.filter(public_slip_code=""):
        for _ in range(32):
            code = get_random_string(8, allowed_chars=alphabet)
            if code not in seen:
                seen.add(code)
                payment.public_slip_code = code
                payment.save(update_fields=["public_slip_code"])
                break


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0008_paymentquickcategory"),
    ]

    operations = [
        migrations.AddField(
            model_name="paymenttransaction",
            name="public_slip_code",
            field=models.CharField(blank=True, db_index=True, default="", max_length=12),
        ),
        migrations.RunPython(backfill_public_slip_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="paymenttransaction",
            name="public_slip_code",
            field=models.CharField(blank=True, db_index=True, default="", max_length=12, unique=True),
        ),
    ]
