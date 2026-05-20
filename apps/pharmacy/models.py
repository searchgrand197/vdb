from decimal import Decimal
from django.conf import settings
from django.db import models
from django.utils import timezone
from apps.shared.models import Hospital, TimeStampedModel, UUIDPrimaryKeyModel
from apps.patients.models import Patient
from apps.doctors.models import DoctorProfile
from apps.inventory.models import Medicine, MedicineBatch


class Pharmacy(TimeStampedModel, UUIDPrimaryKeyModel):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="pharmacies")
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=64, unique=True, blank=True)
    is_active = models.BooleanField(default=True)
    display_name = models.CharField(max_length=200, blank=True, default="")

    def __str__(self) -> str:
        return self.name

    @property
    def branch_label(self) -> str:
        return self.display_name.strip() or self.name


class PharmacySupplier(TimeStampedModel, UUIDPrimaryKeyModel):
    """Purchase party / distributor (Marg-style supplier master)."""

    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name="pharmacy_suppliers")
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=40, blank=True, default="")
    gst_number = models.CharField(max_length=40, blank=True, default="")
    dl_number = models.CharField(max_length=80, blank=True, default="", help_text="Party drug license number for B2B invoices.")
    address = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["pharmacy", "name"]),
            models.Index(fields=["pharmacy", "is_active"]),
        ]

    def __str__(self) -> str:
        return self.name


class PharmacyPurchaseChallan(TimeStampedModel, UUIDPrimaryKeyModel):
    """Persisted purchase challan (Marg-style history); one row per POST to purchase-challan."""

    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name="pharmacy_purchase_challans")
    supplier = models.ForeignKey(
        PharmacySupplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_challans",
    )
    supplier_name_snapshot = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Supplier name at posting time if supplier row is later removed.",
    )
    challan_no = models.CharField(max_length=120, blank=True, default="", db_index=True)
    purchase_date = models.DateField(db_index=True)
    payment_type = models.CharField(max_length=20, blank=True, default="cash")
    gst_enabled = models.BooleanField(default=True)

    total_items = models.PositiveIntegerField(default=0)
    total_strips = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    total_extra_tablets = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal("0"),
        help_text="Base-only quantity lines (tablets not counted as strips).",
    )
    total_base_qty = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    total_taxable = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="pharmacy_purchase_challans_created",
    )

    class Meta:
        ordering = ("-purchase_date", "-created_at")
        indexes = [
            models.Index(fields=["pharmacy", "purchase_date"], name="pharm_pc_hosp_date_idx"),
            models.Index(fields=["pharmacy", "supplier"], name="pharm_pc_hosp_sup_idx"),
        ]

    def __str__(self) -> str:
        return f"PC {self.challan_no or self.id} ({self.purchase_date})"


class PharmacyPurchaseChallanLine(TimeStampedModel, UUIDPrimaryKeyModel):
    challan = models.ForeignKey(
        PharmacyPurchaseChallan,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT, related_name="purchase_challan_lines")
    batch = models.ForeignKey(
        MedicineBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_challan_lines",
    )
    snapshot_batch_no = models.CharField(max_length=80, blank=True, default="")
    snapshot_expiry_date = models.DateField(null=True, blank=True)

    quantity_basis = models.CharField(max_length=10, default="pack")  # pack | base
    pack_type = models.CharField(max_length=40, blank=True, default="")
    conversion = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("1"))
    pack_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    base_qty = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    rate_type = models.CharField(max_length=10, default="STRIP")

    purchase_rate = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    mrp = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    sale_rate = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    discount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    gst_type = models.CharField(max_length=20, blank=True, default="exclusive")
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    no_gst = models.BooleanField(default=False)

    taxable_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    gst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    final_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ("created_at", "id")
        indexes = [models.Index(fields=["challan", "medicine"], name="pharm_pcline_ch_med_idx")]

    def save(self, *args, **kwargs):
        b = self.batch
        if b is not None:
            self.snapshot_batch_no = b.batch_no
            self.snapshot_expiry_date = b.expiry_date
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.medicine_id} / {self.batch_id or self.snapshot_batch_no or '—'}"


class PharmacyOutletSettings(TimeStampedModel, UUIDPrimaryKeyModel):
    """Editable pharmacy letterhead / GST details for invoices (one row per pharmacy)."""

    pharmacy = models.OneToOneField(Pharmacy, on_delete=models.CASCADE, related_name="pharmacy_outlet_settings")
    business_name = models.CharField(max_length=200, blank=True, default="")
    address = models.TextField(blank=True, default="")
    mobile = models.CharField(max_length=40, blank=True, default="")
    gst_number = models.CharField(max_length=40, blank=True, default="")
    dl_number = models.CharField(max_length=40, blank=True, default="")
    email = models.CharField(max_length=120, blank=True, default="")
    website = models.CharField(max_length=200, blank=True, default="")
    invoice_prefix = models.CharField(max_length=20, blank=True, default="INV")
    invoice_next_number = models.PositiveIntegerField(default=1)
    default_gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("5.00"))
    default_sale_discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    b2b_enabled = models.BooleanField(default=False, help_text="When enabled, sales are made to business parties instead of patients.")
    low_stock_threshold = models.PositiveIntegerField(default=10, help_text="Medicines with total stock below this value are flagged as low stock.")
    bank_name = models.CharField(max_length=120, blank=True, default="")
    bank_branch = models.CharField(max_length=120, blank=True, default="")
    bank_account_no = models.CharField(max_length=40, blank=True, default="")
    bank_ifsc = models.CharField(max_length=20, blank=True, default="")
    invoice_terms = models.TextField(
        blank=True,
        default="",
        help_text="Terms & conditions printed on pharmacy invoices (one line per row in the editor).",
    )
    signature = models.ImageField(upload_to="pharmacy/signatures/", blank=True, null=True)

    def __str__(self) -> str:
        return f"Pharmacy settings ({self.pharmacy_id})"


class PharmacyInvoice(TimeStampedModel, UUIDPrimaryKeyModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        FINALIZED = "finalized", "Finalized"
        CANCELLED = "cancelled", "Cancelled"

    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.PROTECT, related_name="pharmacy_invoices")
    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, null=True, blank=True, related_name="pharmacy_invoices")
    party = models.ForeignKey(
        "PharmacySupplier",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="sale_invoices",
        help_text="B2B sale party (used when B2B mode is enabled instead of patient).",
    )
    party_name_snapshot = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Party name captured at invoice time, preserved if the party is later deleted.",
    )
    ipd_admission = models.ForeignKey(
        "ipd.IPDAdmission",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pharmacy_invoices",
    )
    referred_by = models.ForeignKey(DoctorProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name="pharmacy_referrals")
    
    invoice_no = models.CharField(max_length=50, unique=True)
    date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    
    gst_enabled = models.BooleanField(default=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    cgst = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    sgst = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    payment_method = models.CharField(max_length=20, default="cash")
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    
    remarks = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_pharmacy_invoices")

    def __str__(self):
        name = self.party_name_snapshot or (self.patient.first_name if self.patient_id else "—")
        return f"Invoice {self.invoice_no} - {name}"

class PharmacyInvoiceItem(TimeStampedModel, UUIDPrimaryKeyModel):
    invoice = models.ForeignKey(PharmacyInvoice, on_delete=models.CASCADE, related_name="items")
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT, related_name="pharmacy_sale_items")
    batch = models.ForeignKey(
        MedicineBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pharmacy_sale_items",
    )
    snapshot_batch_no = models.CharField(max_length=80, blank=True, default="")
    snapshot_expiry_date = models.DateField(null=True, blank=True)
    
    qty = models.DecimalField(max_digits=12, decimal_places=2)
    mrp = models.DecimalField(max_digits=12, decimal_places=2)
    rate = models.DecimalField(max_digits=12, decimal_places=2) # Sale rate
    
    cgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("6.00"))
    sgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("6.00"))
    
    amount = models.DecimalField(max_digits=12, decimal_places=2) # Excluding tax? Or total?
    # I'll store the total amount for this row (qty * rate) including tax if needed, but standard GST is often rate * qty + taxes.

    def save(self, *args, **kwargs):
        b = self.batch
        if b is not None:
            self.snapshot_batch_no = b.batch_no
            self.snapshot_expiry_date = b.expiry_date
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.medicine.name} x {self.qty}"
