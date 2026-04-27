from django.urls import path, include
from rest_framework import routers
from apps.pharmacy.views import PharmacyInvoiceViewSet, PharmacyInvoiceItemViewSet, DoctorStockSearchView

router = routers.DefaultRouter()
router.register(r'pharmacy-invoices', PharmacyInvoiceViewSet)
router.register(r'pharmacy-invoice-items', PharmacyInvoiceItemViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('pharmacy/doctor-stock-search/', DoctorStockSearchView.as_view(), name='doctor-stock-search'),
]
