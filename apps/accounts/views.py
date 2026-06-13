from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.accounts.serializers import (
    PasswordChangeSerializer,
    PublicPasswordChangeSerializer,
    UserProfileSerializer,
    UserProfileUpdateSerializer,
)
from apps.roles_permissions.effective_permissions import (
    auth_session_payload_for_user,
    user_may_access_pharmacy,
)
from apps.roles_permissions.portal_registry import ALL_PORTAL_CODES
from apps.shared.response import success_response

User = get_user_model()


class TokenObtainPairWithResponse(TokenObtainPairView):
    """
    SimpleJWT login endpoint.

    Returns the default SimpleJWT payload but wrapped in our standard response shape,
    enriched with user profile data including hospital_id.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        intended_portal = (request.data.get("intended_portal") or request.data.get("portal") or "").strip().lower()
        if intended_portal and intended_portal not in ALL_PORTAL_CODES:
            return Response(
                {
                    "success": False,
                    "errors": {
                        "detail": ["Unknown portal selection."],
                        "allowed_portals": [],
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        response = super().post(request, *args, **kwargs)
        if response.status_code < 400:
            data = dict(response.data)
            try:
                from rest_framework_simplejwt.tokens import AccessToken

                token = AccessToken(data["access"])
                user_id = token["user_id"]
                user = User.objects.select_related("hospital").get(pk=user_id)
                data["hospital_id"] = str(user.hospital_id) if user.hospital_id else None
                data["email"] = user.email
                data["first_name"] = user.first_name
                data["last_name"] = user.last_name
                data["is_superuser"] = user.is_superuser
                data.update(auth_session_payload_for_user(user))
                if intended_portal and intended_portal not in data.get("allowed_portals", []):
                    return Response(
                        {
                            "success": False,
                            "errors": {
                                "detail": [
                                    "Your account is not allowed to access this portal. "
                                    "Contact your administrator."
                                ],
                                "allowed_portals": data.get("allowed_portals", []),
                            },
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )
                pharmacy_branch_id = (
                    request.data.get("pharmacy_branch_id")
                    or request.data.get("pharmacy_branch")
                    or ""
                )
                pharmacy_branch_id = str(pharmacy_branch_id).strip()
                if intended_portal == "pharmacy" and pharmacy_branch_id:
                    if not user_may_access_pharmacy(user, pharmacy_branch_id):
                        return Response(
                            {
                                "success": False,
                                "errors": {
                                    "detail": [
                                        "Your account is not allowed to access this pharmacy branch. "
                                        "Contact your administrator."
                                    ],
                                    "allowed_pharmacy_ids": data.get("allowed_pharmacy_ids", []),
                                },
                            },
                            status=status.HTTP_403_FORBIDDEN,
                        )
            except Exception:
                pass
            return success_response(data=data)
        return response


class AuthMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        payload = {
            "id": str(user.id),
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_active": user.is_active,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "hospital_id": str(user.hospital_id) if user.hospital_id else None,
            "hospital_name": user.hospital.name if getattr(user, "hospital", None) else None,
        }
        payload.update(auth_session_payload_for_user(user))
        return success_response(data=payload)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get("refresh_token")
        if not refresh_token:
            return Response(
                {"success": False, "errors": {"refresh_token": ["This field is required."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token = RefreshToken(refresh_token)
        token.blacklist()
        return success_response(message="Logged out successfully.")


class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        serializer = UserProfileSerializer(request.user)
        return success_response(data=serializer.data)

    def patch(self, request, *args, **kwargs):
        serializer = UserProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=UserProfileSerializer(request.user).data)


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return success_response(message="Password changed successfully.")


class PublicPasswordChangeView(APIView):
    """
    POST /api/v1/auth/change-password/

    For users who know their email and current password (e.g. after receiving an initial password).
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = PublicPasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(
            message="Your password was updated successfully. You can sign in with your new password."
        )


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        email = request.data.get("email")
        if not email:
            return Response(
                {"success": False, "errors": {"email": ["This field is required."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Do not reveal whether email exists.
            return success_response(message="If the account exists, reset details are returned.")

        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        # Optional email hook (API clients often prefer getting the token directly).
        if str(getattr(settings, "SEND_RESET_EMAILS", False)).lower() == "true":
            reset_path = f"/password-reset/confirm?uid={uidb64}&token={token}"
            send_mail(
                subject="Your password reset details",
                message=f"Use the following to reset your password: {reset_path}",
                from_email="no-reply@example.com",
                recipient_list=[user.email],
                fail_silently=True,
            )

        return success_response(
            data={"uidb64": uidb64, "token": token},
            message="Password reset details generated.",
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        uidb64 = request.data.get("uidb64")
        token = request.data.get("token")
        new_password = request.data.get("new_password")
        confirm_password = request.data.get("confirm_password")

        if not all([uidb64, token, new_password, confirm_password]):
            return Response(
                {"success": False, "errors": {"detail": ["uidb64, token, new_password, confirm_password are required."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password != confirm_password:
            return Response(
                {"success": False, "errors": {"confirm_password": ["Passwords do not match."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=uid)
        except Exception:
            return Response(
                {"success": False, "errors": {"detail": ["Invalid uid."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"success": False, "errors": {"detail": ["Token is invalid or has expired."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return success_response(message="Password reset successfully.")


class PharmacyBranchListView(APIView):
    """
    GET /api/v1/auth/pharmacies/

    Returns active pharmacy branches. Unauthenticated callers see all branches
    (login page). Authenticated non-superusers are limited to their allowed list
    when configured on staff profile(s).
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        from apps.pharmacy.models import Pharmacy
        from apps.roles_permissions.effective_permissions import allowed_pharmacies_for_user

        qs = Pharmacy.objects.filter(is_active=True)
        user = getattr(request, "user", None)
        if user and user.is_authenticated and not user.is_superuser:
            allowed_ids = allowed_pharmacies_for_user(user)
            if allowed_ids:
                qs = qs.filter(id__in=allowed_ids)

        branches = qs.order_by("display_name", "name").values("id", "name", "display_name")
        data = [
            {
                "id": str(b["id"]),
                "label": (b["display_name"] or "").strip() or b["name"],
                "name": b["name"],
            }
            for b in branches
        ]
        return success_response(data=data)



