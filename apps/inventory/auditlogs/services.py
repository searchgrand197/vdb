from __future__ import annotations

from typing import Any, Dict, Optional

from django.utils import timezone

from apps.auditlogs.models import AuditLog
from apps.shared.models import Hospital


def create_audit_log(
    *,
    request,
    hospital: Optional[Hospital] = None,
    pharmacy=None,
    module: str,
    action: str,
    obj: Any = None,
    before: Optional[Dict[str, Any]] = None,
    after: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """
    Writes an audit log entry for critical events.
    """

    if hospital is None and pharmacy is not None:
        hospital = getattr(pharmacy, "hospital", None)

    actor = getattr(request, "user", None)
    if actor is not None and getattr(actor, "is_authenticated", False) is not True:
        actor = None

    meta = getattr(request, "META", {}) or {}
    x_forwarded_for = meta.get("HTTP_X_FORWARDED_FOR")
    ip_address = x_forwarded_for.split(",")[0].strip() if x_forwarded_for else meta.get("REMOTE_ADDR")
    user_agent = meta.get("HTTP_USER_AGENT", "") or ""

    request_id = ""
    try:
        request_id = request.headers.get("X-Request-ID", "")  # type: ignore[attr-defined]
    except Exception:
        request_id = ""

    object_type = ""
    object_id = ""
    if obj is not None:
        object_type = obj.__class__.__name__
        object_id = str(getattr(obj, "pk", "")) or ""

    return AuditLog.objects.create(
        hospital=hospital,
        actor=actor,
        module=module,
        action=action,
        object_type=object_type,
        object_id=object_id,
        before=before,
        after=after,
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=request_id,
    )

