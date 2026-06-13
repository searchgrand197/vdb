/**
 * Parses DELETE /specialties/:id/ conflict payload (linked doctors).
 * Ignores generic `{ errors: { detail } }` bodies that omit linked_* keys (e.g. login errors).
 * @param {unknown} err — Axios error
 * @returns {{ detail: string | null; linkedDoctors: object[]; linkedCounts: object | null; truncated: object | null } | null}
 */
export function parseSpecialtyDeleteError(err) {
  const res = err?.response?.data;
  const e = res?.errors;
  if (!e || typeof e !== 'object') return null;

  const hasLinkedKeys = Object.prototype.hasOwnProperty.call(e, 'linked_doctors');
  if (!hasLinkedKeys) return null;

  return {
    detail: e.detail != null ? String(e.detail) : null,
    linkedDoctors: Array.isArray(e.linked_doctors) ? e.linked_doctors : [],
    linkedCounts: e.linked_counts && typeof e.linked_counts === 'object' ? e.linked_counts : null,
    truncated: e.truncated && typeof e.truncated === 'object' ? e.truncated : null,
  };
}
