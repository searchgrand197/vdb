/**
 * Parses DELETE /departments/:id/ conflict payload (linked staff / doctors / specialties).
 * Ignores generic `{ errors: { detail } }` bodies that omit linked_* keys (e.g. login errors).
 * @param {unknown} err — Axios error
 * @returns {{ detail: string | null; linkedStaff: object[]; linkedDoctors: object[]; linkedSpecialties: object[]; linkedCounts: object | null; truncated: object | null } | null}
 */
export function parseDepartmentDeleteError(err) {
  const res = err?.response?.data;
  const e = res?.errors;
  if (!e || typeof e !== 'object') return null;

  const hasLinkedKeys =
    Object.prototype.hasOwnProperty.call(e, 'linked_staff') ||
    Object.prototype.hasOwnProperty.call(e, 'linked_doctors') ||
    Object.prototype.hasOwnProperty.call(e, 'linked_specialties');
  if (!hasLinkedKeys) return null;

  return {
    detail: e.detail != null ? String(e.detail) : null,
    linkedStaff: Array.isArray(e.linked_staff) ? e.linked_staff : [],
    linkedDoctors: Array.isArray(e.linked_doctors) ? e.linked_doctors : [],
    linkedSpecialties: Array.isArray(e.linked_specialties) ? e.linked_specialties : [],
    linkedCounts: e.linked_counts && typeof e.linked_counts === 'object' ? e.linked_counts : null,
    truncated: e.truncated && typeof e.truncated === 'object' ? e.truncated : null,
  };
}
