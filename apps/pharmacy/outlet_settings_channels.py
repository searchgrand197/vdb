"""B2B / B2C channel profiles on PharmacyOutletSettings."""

from __future__ import annotations

from typing import Any, Literal

Channel = Literal["b2c", "b2b"]

# Duplicated per channel (prefix: b2c_ / b2b_)
CHANNEL_PROFILE_FIELDS: tuple[str, ...] = (
    "address",
    "mobile",
    "gst_number",
    "dl_number",
    "email",
    "website",
    "invoice_prefix",
    "invoice_next_number",
    "default_gst_percent",
    "default_sale_gst_enabled",
    "sale_bill_qty_display",
    "bank_name",
    "bank_branch",
    "bank_account_no",
    "bank_ifsc",
    "invoice_terms",
)

# B2C-only; not copied to B2B when apply_to_both from B2C
B2C_ONLY_FIELDS: tuple[str, ...] = (
    "default_sale_discount_percent",
    "low_stock_threshold",
)

SIGNATURE_FIELD = "signature"


def prefixed(channel: Channel, field: str) -> str:
    return f"{channel}_{field}"


def signature_field(channel: Channel) -> str:
    return prefixed(channel, SIGNATURE_FIELD)


def channel_profile_from_instance(obj, channel: Channel) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for field in CHANNEL_PROFILE_FIELDS:
        out[field] = getattr(obj, prefixed(channel, field), None)
    if channel == "b2c":
        out["default_sale_discount_percent"] = getattr(obj, "b2c_default_sale_discount_percent", None)
        out["low_stock_threshold"] = getattr(obj, "b2c_low_stock_threshold", None)
    sig = getattr(obj, signature_field(channel), None)
    out[SIGNATURE_FIELD] = sig
    return out


def apply_channel_profile_to_instance(obj, channel: Channel, data: dict[str, Any]) -> list[str]:
    """Apply nested channel dict to model; returns updated field names."""
    updated: list[str] = []
    for field in CHANNEL_PROFILE_FIELDS:
        if field not in data:
            continue
        attr = prefixed(channel, field)
        setattr(obj, attr, data[field])
        updated.append(attr)
    if channel == "b2c":
        if "default_sale_discount_percent" in data:
            obj.b2c_default_sale_discount_percent = data["default_sale_discount_percent"]
            updated.append("b2c_default_sale_discount_percent")
        if "low_stock_threshold" in data:
            obj.b2c_low_stock_threshold = data["low_stock_threshold"]
            updated.append("b2c_low_stock_threshold")
    return updated


def apply_nested_settings_patch(obj, validated: dict[str, Any], request=None) -> list[str]:
    """Apply PATCH payload; returns all updated DB field names."""
    updated: list[str] = []
    if "business_name" in validated:
        obj.business_name = validated["business_name"]
        updated.append("business_name")
    if "b2b_enabled" in validated:
        obj.b2b_enabled = validated["b2b_enabled"]
        updated.append("b2b_enabled")

    mode = validated.get("mode")
    apply_both = bool(validated.get("apply_to_both"))

    channels_to_apply: list[Channel] = []
    if mode in ("b2c", "b2b"):
        channels_to_apply.append(mode)
        nested = validated.get(mode)
        if nested:
            updated.extend(apply_channel_profile_to_instance(obj, mode, nested))
        sig_file = None
        if request is not None:
            sig_file = request.FILES.get(f"{mode}_signature")
        if sig_file:
            getattr(obj, signature_field(mode)).save(sig_file.name, sig_file, save=False)
            updated.append(signature_field(mode))
        if apply_both:
            copy_channel_profile(obj, mode, "b2b" if mode == "b2c" else "b2c")
            for field in CHANNEL_PROFILE_FIELDS:
                updated.append(prefixed("b2b" if mode == "b2c" else "b2c", field))
            if mode == "b2c":
                # B2C-only fields are not copied to B2B
                pass
            tgt = "b2b" if mode == "b2c" else "b2c"
            if sig_file or getattr(obj, signature_field(mode), None):
                if copy_signature_file(obj, mode, tgt):
                    updated.append(signature_field(tgt))
    else:
        for ch in ("b2c", "b2b"):
            nested = validated.get(ch)
            if nested:
                updated.extend(apply_channel_profile_to_instance(obj, ch, nested))
            if request is not None:
                sig_file = request.FILES.get(f"{ch}_signature")
                if sig_file:
                    getattr(obj, signature_field(ch)).save(sig_file.name, sig_file, save=False)
                    updated.append(signature_field(ch))

    return list(dict.fromkeys(updated))


def copy_channel_profile(obj, source: Channel, target: Channel) -> list[str]:
    """Copy profile from source channel to target; omits B2C-only fields when target is b2b."""
    src = channel_profile_from_instance(obj, source)
    if target == "b2b":
        for field in B2C_ONLY_FIELDS:
            src.pop(field, None)
    return apply_channel_profile_to_instance(obj, target, src)


def copy_signature_file(obj, source: Channel, target: Channel) -> str | None:
    src_attr = signature_field(source)
    tgt_attr = signature_field(target)
    src_file = getattr(obj, src_attr, None)
    if not src_file:
        return None
    try:
        src_file.open("rb")
        from django.core.files.base import ContentFile

        content = src_file.read()
        src_file.close()
        base = src_file.name.split("/")[-1] if src_file.name else "signature.png"
        getattr(obj, tgt_attr).save(base, ContentFile(content), save=False)
        return tgt_attr
    except Exception:
        return None


def nested_settings_response(obj, request=None) -> dict[str, Any]:
    def sig_url(channel: Channel) -> str:
        f = getattr(obj, signature_field(channel), None)
        if not f:
            return ""
        url = f.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url

    def pack_channel(channel: Channel) -> dict[str, Any]:
        prof = channel_profile_from_instance(obj, channel)
        prof["signature_url"] = sig_url(channel)
        prof.pop(SIGNATURE_FIELD, None)
        if channel == "b2c":
            prof["default_sale_discount_percent"] = str(
                getattr(obj, "b2c_default_sale_discount_percent", "0") or "0"
            )
            prof["low_stock_threshold"] = int(getattr(obj, "b2c_low_stock_threshold", 10) or 10)
        # Normalize decimals / ints for JSON
        if prof.get("default_gst_percent") is not None:
            prof["default_gst_percent"] = str(prof["default_gst_percent"])
        if prof.get("default_sale_discount_percent") is not None and channel == "b2c":
            prof["default_sale_discount_percent"] = str(prof["default_sale_discount_percent"])
        prof["default_sale_gst_enabled"] = bool(prof.get("default_sale_gst_enabled"))
        prof["invoice_next_number"] = int(prof.get("invoice_next_number") or 1)
        return prof

    return {
        "id": str(obj.id),
        "business_name": obj.business_name or "",
        "b2b_enabled": bool(obj.b2b_enabled),
        "b2c": pack_channel("b2c"),
        "b2b": pack_channel("b2b"),
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
    }
