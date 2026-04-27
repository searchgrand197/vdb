from django.contrib import admin, messages
from django.utils.text import slugify

from apps.shared.models import Hospital


def _clone_pharmacy_outlet_settings(source_hospital, new_hospital):
    """Copy PharmacyOutletSettings from source_hospital to new_hospital (if it exists)."""
    try:
        from apps.pharmacy.models import PharmacyOutletSettings

        src = PharmacyOutletSettings.objects.filter(hospital=source_hospital).first()
        if src:
            PharmacyOutletSettings.objects.get_or_create(
                hospital=new_hospital,
                defaults={
                    "business_name": new_hospital.pharmacy_display_name or new_hospital.name,
                    "address": src.address,
                    "mobile": src.mobile,
                    "gst_number": "",  # Must be set independently per branch
                    "dl_number": "",   # Must be set independently per branch
                    "email": src.email,
                    "website": src.website,
                    "default_gst_percent": src.default_gst_percent,
                    "default_sale_discount_percent": src.default_sale_discount_percent,
                },
            )
    except Exception:
        pass  # Pharmacy app may not be migrated yet; skip silently


@admin.action(description="🏪 Clone selected hospital as a new Pharmacy Branch")
def clone_as_pharmacy_branch(modeladmin, request, queryset):
    """
    Django Admin action — creates an independent pharmacy branch for each
    selected Hospital.

    Steps:
    1. Marks the source hospital as is_pharmacy=True (so it appears in dropdown)
    2. Creates a new Hospital row (the cloned branch) with is_pharmacy=True
    3. Copies PharmacyOutletSettings config (without GST/DL numbers — must be
       set independently per branch)
    4. Displays a summary message with the new branch details
    """
    if queryset.count() > 1:
        modeladmin.message_user(
            request,
            "⚠️  Please select only ONE hospital to clone at a time.",
            level=messages.WARNING,
        )
        return

    source = queryset.first()

    # ── 1. Mark the source as is_pharmacy if not already ──────────────────
    if not source.is_pharmacy:
        source.is_pharmacy = True
        if not source.pharmacy_display_name:
            source.pharmacy_display_name = "Main Branch"
        source.save(update_fields=["is_pharmacy", "pharmacy_display_name"])

    # ── 2. Determine branch number ─────────────────────────────────────────
    existing_clones = Hospital.objects.filter(
        slug__startswith=f"{source.slug}-branch-"
    ).count()
    branch_num = existing_clones + 2  # e.g. Branch 2, Branch 3 …

    new_name = f"{source.name} — Branch {branch_num}"
    new_slug_base = f"{source.slug}-branch-{branch_num}"

    # Ensure uniqueness of slug
    new_slug = new_slug_base
    counter = 1
    while Hospital.objects.filter(slug=new_slug).exists():
        counter += 1
        new_slug = f"{new_slug_base}-{counter}"

    # Ensure uniqueness of name
    new_name_final = new_name
    counter = 1
    while Hospital.objects.filter(name=new_name_final).exists():
        counter += 1
        new_name_final = f"{new_name} ({counter})"

    # ── 3. Create the new Hospital (branch) ───────────────────────────────
    new_hospital = Hospital.objects.create(
        name=new_name_final,
        slug=new_slug,
        timezone=source.timezone,
        is_active=False,  # Admin must explicitly activate
        is_pharmacy=True,
        pharmacy_display_name=f"Branch {branch_num}",
    )

    # ── 4. Copy PharmacyOutletSettings ────────────────────────────────────
    _clone_pharmacy_outlet_settings(source, new_hospital)

    modeladmin.message_user(
        request,
        (
            f"✅  New pharmacy branch created: \"{new_hospital.name}\" (slug: {new_hospital.slug}). "
            f"It is currently INACTIVE — go to Hospitals and set is_active=True when ready. "
            f"Remember to update the GST number, DL number, and Pharmacy Display Name for this branch. "
            f"Then create a User account assigned to this hospital so staff can log in."
        ),
        level=messages.SUCCESS,
    )


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "slug",
        "pharmacy_display_name",
        "is_pharmacy",
        "is_active",
        "timezone",
        "created_at",
    )
    search_fields = ("name", "slug", "pharmacy_display_name")
    list_filter = ("is_active", "is_pharmacy")
    actions = [clone_as_pharmacy_branch]

    fieldsets = (
        (None, {"fields": ("name", "slug", "timezone", "is_active")}),
        (
            "Pharmacy Branch Settings",
            {
                "fields": ("is_pharmacy", "pharmacy_display_name"),
                "description": (
                    "Enable is_pharmacy to make this hospital appear as a selectable "
                    "pharmacy branch on the login page. Set pharmacy_display_name to a "
                    "short label like 'Main Branch' or 'City Mall'."
                ),
            },
        ),
    )
