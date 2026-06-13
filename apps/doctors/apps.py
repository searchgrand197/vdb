from django.apps import AppConfig


class DoctorsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.doctors'

    def ready(self):
        # Register signal handlers (doctor profile → placeholder user when needed).
        from . import signals  # noqa: F401
