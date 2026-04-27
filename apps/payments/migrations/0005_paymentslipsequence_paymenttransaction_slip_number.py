from django.db import migrations, models


def backfill_slip_numbers(apps, schema_editor):
    PaymentTransaction = apps.get_model("payments", "PaymentTransaction")
    PaymentSlipSequence = apps.get_model("payments", "PaymentSlipSequence")
    Hospital = apps.get_model("shared", "Hospital")

    def build_slip_number(hospital_obj, year, seq):
        raw = (getattr(hospital_obj, "slug", "") or getattr(hospital_obj, "name", "HOSP") or "HOSP")
        slug_part = "".join(ch for ch in str(raw).upper() if ch.isalnum())[:5] or "HOSP"
        return f"PSL-{slug_part}-{year}-{seq:06d}"

    payments = PaymentTransaction.objects.all().order_by("hospital_id", "paid_at", "created_at", "id")
    sequence_cache = {}

    for payment in payments:
        if payment.slip_number:
            continue
        dt = payment.paid_at or payment.created_at
        year = dt.year
        key = (payment.hospital_id, year)

        seq_obj = sequence_cache.get(key)
        if not seq_obj:
            seq_obj, _ = PaymentSlipSequence.objects.get_or_create(
                hospital_id=payment.hospital_id,
                year=year,
                defaults={"last_seq": 0},
            )
            sequence_cache[key] = seq_obj

        seq_obj.last_seq += 1
        hospital = Hospital.objects.filter(id=payment.hospital_id).only("id", "slug", "name").first()
        payment.slip_number = build_slip_number(hospital, year, seq_obj.last_seq)
        payment.save(update_fields=["slip_number", "updated_at"])
        seq_obj.save(update_fields=["last_seq", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0004_rename_payments_pa_hospita_8f1f74_idx_payments_pa_hospita_6ff6cc_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="PaymentSlipSequence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("year", models.PositiveIntegerField()),
                ("last_seq", models.PositiveIntegerField(default=0)),
                ("hospital", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="payment_slip_sequences", to="shared.hospital")),
            ],
            options={
                "unique_together": {("hospital", "year")},
            },
        ),
        migrations.AddField(
            model_name="paymenttransaction",
            name="slip_number",
            field=models.CharField(blank=True, db_index=True, default="", max_length=80),
        ),
        migrations.RunPython(backfill_slip_numbers, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="paymenttransaction",
            name="slip_number",
            field=models.CharField(blank=True, db_index=True, default="", max_length=80, unique=True),
        ),
    ]
