/**
 * Parses DELETE /designations/:id/ conflict payload (linked staff).
 * @param {unknown} err — Axios error
 * @returns {{ detail: string | null; linkedStaff: object[]; linkedCounts: object | null; truncated: object | null } | null}
 */
export function parseDesignationDeleteError(err) {
  const res = err?.response?.data;
  let e = res?.errors;
  if ((!e || typeof e !== 'object') && res?.data?.errors && typeof res.data.errors === 'object') {
    e = res.data.errors;
  }
  if ((!e || typeof e !== 'object') && res?.error?.errors && typeof res.error.errors === 'object') {
    e = res.error.errors;
  }
  if ((!e || typeof e !== 'object') && res?.data && typeof res.data === 'object') {
    e = res.data;
  }
  if (!e || typeof e !== 'object') return null;

  const linkedStaffRaw =
    e.linked_staff ??
    e.linkedStaff ??
    e.staff ??
    e.linked?.staff;
  const detail = e.detail != null ? String(e.detail) : null;
  const hasLinkedStaff = Array.isArray(linkedStaffRaw);

  // Treat detail-only delete errors as conflicts too, so dialog matches departments UX.
  if (!hasLinkedStaff && !detail) return null;

  return {
    detail,
    linkedStaff: hasLinkedStaff ? linkedStaffRaw : [],
    linkedCounts: e.linked_counts && typeof e.linked_counts === 'object' ? e.linked_counts : null,
    truncated: e.truncated && typeof e.truncated === 'object' ? e.truncated : null,
  };
}
