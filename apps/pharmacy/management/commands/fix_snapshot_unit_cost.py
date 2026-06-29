"""
Management command: fix_snapshot_unit_cost

Repairs PharmacyInvoiceItem rows where snapshot_unit_cost is 0 (or NULL),
which causes 0-margin display for medicines whose batch has been removed.

Lookup priority (same as resolve_invoice_item_unit_cost in margin_utils.py):
  1. Live batch.unit_cost       (batch still exists)
  2. snapshot_unit_cost field   (already set – skip)
  3. Purchase challan line      (snapshot_batch_no or batch.batch_no match)
  4. Sibling invoice item       (same medicine + same batch_no, non-zero cost)

Run on production:
  python manage.py fix_snapshot_unit_cost
  python manage.py fix_snapshot_unit_cost --dry-run      # preview only
  python manage.py fix_snapshot_unit_cost --pharmacy=<id> # single pharmacy
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Q

ZERO = Decimal("0")


class Command(BaseCommand):
    help = "Backfill snapshot_unit_cost=0 on pharmacy invoice items using challan / sibling data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Print what would be updated without actually saving.",
        )
        parser.add_argument(
            "--pharmacy",
            type=str,
            default=None,
            help="Limit to a specific pharmacy UUID.",
        )
        parser.add_argument(
            "--chunk",
            type=int,
            default=500,
            help="Queryset iterator chunk size (default 500).",
        )

    def handle(self, *args, **options):
        from apps.pharmacy.models import PharmacyInvoiceItem, PharmacyPurchaseChallanLine

        dry_run = options["dry_run"]
        pharmacy_id = options["pharmacy"]
        chunk = options["chunk"]

        qs = PharmacyInvoiceItem.objects.select_related("batch", "medicine").filter(
            Q(snapshot_unit_cost__isnull=True) | Q(snapshot_unit_cost=ZERO)
        )
        if pharmacy_id:
            qs = qs.filter(invoice__pharmacy_id=pharmacy_id)

        total = qs.count()
        self.stdout.write(f"Found {total} item(s) with missing/zero snapshot_unit_cost.")

        fixed = 0
        skipped = 0

        for item in qs.iterator(chunk_size=chunk):
            cost = self._resolve(item, PharmacyPurchaseChallanLine)
            if cost is None or cost <= ZERO:
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(
                    f"  [DRY] Item {item.pk} | medicine={item.medicine_id} "
                    f"batch_no={item.snapshot_batch_no or '—'} → cost={cost}"
                )
            else:
                PharmacyInvoiceItem.objects.filter(pk=item.pk).update(
                    snapshot_unit_cost=cost
                )
            fixed += 1

        mode = "[DRY RUN] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{mode}Done. Fixed: {fixed}  |  Could not resolve: {skipped}"
            )
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _batch_no(self, item) -> str:
        if item.batch_id and item.batch:
            return (item.batch.batch_no or "").strip()
        return (item.snapshot_batch_no or "").strip()

    def _resolve(self, item, ChallanLine):
        # 1. Live batch still exists
        if item.batch_id and item.batch:
            cost = item.batch.unit_cost
            if cost is not None and cost > ZERO:
                return cost

        # 2. Already has a non-zero snapshot (shouldn't reach here, but guard)
        snap = item.snapshot_unit_cost
        if snap is not None and snap > ZERO:
            return snap

        batch_no = self._batch_no(item)
        medicine_id = item.medicine_id

        # 3. Purchase challan line
        if medicine_id and batch_no:
            cost = self._challan_cost(ChallanLine, medicine_id, batch_no)
            if cost is not None and cost > ZERO:
                return cost

        # 4. Sibling invoice item with same medicine + batch_no
        if medicine_id and batch_no:
            cost = self._sibling_cost(medicine_id, batch_no, exclude_pk=item.pk)
            if cost is not None and cost > ZERO:
                return cost

        return None

    def _challan_cost(self, ChallanLine, medicine_id, batch_no):
        line = (
            ChallanLine.objects.filter(medicine_id=medicine_id)
            .filter(
                Q(snapshot_batch_no=batch_no) | Q(batch__batch_no=batch_no)
            )
            .exclude(purchase_rate=ZERO)
            .order_by("-created_at")
            .first()
        )
        if line and line.purchase_rate and line.purchase_rate > ZERO:
            return line.purchase_rate
        return None

    def _sibling_cost(self, medicine_id, batch_no, exclude_pk=None):
        from apps.pharmacy.models import PharmacyInvoiceItem

        qs = (
            PharmacyInvoiceItem.objects.filter(
                medicine_id=medicine_id,
                snapshot_batch_no=batch_no,
            )
            .exclude(snapshot_unit_cost=ZERO)
            .order_by("-created_at")
        )
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        sib = qs.first()
        if sib and sib.snapshot_unit_cost and sib.snapshot_unit_cost > ZERO:
            return sib.snapshot_unit_cost
        return None
