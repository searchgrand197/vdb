from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.discharge.views import DischargeSummaryTemplateViewSet, DischargeSummaryViewSet

router = DefaultRouter()
router.register("summaries/templates", DischargeSummaryTemplateViewSet, basename="discharge-summary-template")
router.register("summaries", DischargeSummaryViewSet, basename="discharge-summary")

urlpatterns = [
    path("", include(router.urls)),
]
