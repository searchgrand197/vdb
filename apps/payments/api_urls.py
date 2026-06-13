"""Payments API paths. ViewSets are registered in ``config.api_v1_router_urls``."""

from django.urls import path

from apps.payments.views import (
    handover_balance,
    hospital_collection,
    initiate_handover,
    pending_handovers,
    verify_handover,
)

urlpatterns = [
    path("handovers/balance/", handover_balance, name="handover-balance"),
    path("handovers/hospital-collection/", hospital_collection, name="handover-hospital-collection"),
    path("handovers/initiate/", initiate_handover, name="handover-initiate"),
    path("handovers/pending/", pending_handovers, name="handover-pending"),
    path("handovers/verify/", verify_handover, name="handover-verify"),
]
