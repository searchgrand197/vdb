"""Send a test SMS using Twilio settings from .env"""

from django.core.management.base import BaseCommand

from apps.opd.sms_utils import build_opd_scheduled_sms_body, format_phone_e164, get_twilio_config


class Command(BaseCommand):
    help = "Send a test OPD-style SMS via Twilio (verifies .env credentials)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--to",
            default="8814067670",
            help="Destination mobile (10 digits or E.164). Default: 8814067670",
        )

    def handle(self, *args, **options):
        account_sid, auth_token, from_number = get_twilio_config()
        if not all([account_sid, auth_token, from_number]):
            self.stderr.write(self.style.ERROR("Twilio not configured in .env"))
            return

        to_number = format_phone_e164(options["to"])
        if not to_number:
            self.stderr.write(self.style.ERROR(f"Invalid phone: {options['to']!r}"))
            return

        body = build_opd_scheduled_sms_body(
            patient_name="Test Patient",
            opd_no="OPD-TEST-001",
            doctor_name="Dr. Test",
        )

        from twilio.rest import Client

        client = Client(account_sid, auth_token)
        message = client.messages.create(from_=from_number, body=body, to=to_number)
        self.stdout.write(
            self.style.SUCCESS(
                f"Sent to {to_number} — sid={message.sid} status={message.status}"
            )
        )
