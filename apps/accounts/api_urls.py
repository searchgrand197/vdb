from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.connectivity_views import ConnectivityPingView
from apps.accounts.views import (
    AuthMeView,
    LogoutView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PasswordChangeView,
    PublicPasswordChangeView,
    PharmacyBranchListView,
    TokenObtainPairWithResponse,
    UserProfileView,
)

urlpatterns = [
    path("auth/login/", TokenObtainPairWithResponse.as_view(), name="auth-login"),
    path("auth/me/", AuthMeView.as_view(), name="auth-me"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/profile/", UserProfileView.as_view(), name="auth-profile"),
    path("auth/password-change/", PasswordChangeView.as_view(), name="auth-password-change"),
    path("auth/change-password/", PublicPasswordChangeView.as_view(), name="auth-change-password-public"),
    path("auth/password-reset/request/", PasswordResetRequestView.as_view(), name="auth-password-reset-request"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
    # Public: pharmacy branch list for login-page selector
    path("auth/pharmacies/", PharmacyBranchListView.as_view(), name="auth-pharmacies"),
    path("connectivity/ping/", ConnectivityPingView.as_view(), name="connectivity-ping"),
]


