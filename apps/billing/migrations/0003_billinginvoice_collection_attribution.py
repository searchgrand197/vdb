from django.conf import settings
from django.db import migrations, models


def backfill_invoice_attribution(apps, schema_editor):
    BillingInvoice = apps.get_model("billing", "BillingInvoice")
    for invoice in BillingInvoice.objects.select_related("opd_visit", "ipd_admission").iterator():
        doctor_id = None
        if invoice.opd_visit_id:
            visit = invoice.opd_visit
            if visit and visit.doctor_user_id:
                doctor_id = visit.doctor_user_id
        if not doctor_id and invoice.ipd_admission_id:
            admission = invoice.ipd_admission
            if admission and admission.assigned_doctor_id:
                doctor_id = admission.assigned_doctor_id
        if doctor_id:
            invoice.attribution_type = "doctor"
            invoice.attributed_doctor_user_id = doctor_id
        else:
            invoice.attribution_type = "hospital_self"
            invoice.attributed_doctor_user_id = None
        invoice.save(update_fields=["attribution_type", "attributed_doctor_user_id"])


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
        ("billing", "0002_invoiceitem_category_invoiceitem_subcategory"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="billinginvoice",
            name="attribution_type",
            field=models.CharField(
                choices=[("doctor", "Doctor"), ("hospital_self", "Self (Hospital)")],
                db_index=True,
                default="hospital_self",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="billinginvoice",
            name="attributed_doctor_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="attributed_invoices",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(backfill_invoice_attribution, migrations.RunPython.noop),
    ]
