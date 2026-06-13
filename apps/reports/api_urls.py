from django.urls import path

from apps.reports.views import CollectionSummaryView, DoctorRevenueView

urlpatterns = [
    path("collection-summary/", CollectionSummaryView.as_view(), name="reports-collection-summary"),
    path("doctor-revenue/", DoctorRevenueView.as_view(), name="reports-doctor-revenue"),
]
