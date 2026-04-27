"""
Delete patients whose UHID does not start with a given prefix.

Usage:
    python scripts/delete_patients_without_uid_prefix.py
    python scripts/delete_patients_without_uid_prefix.py --prefix DEF --commit

Default behavior is dry-run (no delete). Pass --commit to apply deletion.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def bootstrap_django() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(repo_root))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

    import django  # noqa: WPS433

    django.setup()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Delete patients whose UHID does not start with the provided prefix.",
    )
    parser.add_argument(
        "--prefix",
        default="DEF",
        help="UHID prefix to keep (default: DEF).",
    )
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Actually delete records. Without this flag, script runs as dry-run.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    bootstrap_django()

    from apps.patients.models import Patient  # noqa: WPS433

    keep_prefix = (args.prefix or "").strip()
    if not keep_prefix:
        raise SystemExit("Prefix cannot be empty.")

    target_qs = Patient.objects.exclude(uhid__istartswith=keep_prefix)
    total_target = target_qs.count()
    total_patients = Patient.objects.count()

    print(f"Total patients: {total_patients}")
    print(f"Patients NOT starting with '{keep_prefix}': {total_target}")

    if not args.commit:
        print("Dry-run only. Re-run with --commit to delete these patients.")
        return

    deleted_count, details = target_qs.delete()
    print(f"Deleted rows (including related cascades): {deleted_count}")
    print("Delete details by model:")
    for model_label, count in details.items():
        print(f"  - {model_label}: {count}")


if __name__ == "__main__":
    main()
