const FORM_FIELDS = new Set(['name', 'code', 'department', 'description', 'is_active']);

function firstMessage(val) {
  if (Array.isArray(val) && val.length) return val.map(String).join(' ');
  if (typeof val === 'string' && val.trim()) return val.trim();
  return null;
}

/**
 * Parses `{ success: false, errors: { name: [...], code: [...] } }` from specialty create/update.
 * @returns {{ fields: Record<string, string>, general: string | null }}
 */
export function parseSpecialtyFieldErrors(err) {
  const body = err?.response?.data;
  if (!body || typeof body !== 'object') {
    return { fields: {}, general: null };
  }

  let errObj = body.errors;
  if ((!errObj || typeof errObj !== 'object') && body.data?.errors && typeof body.data.errors === 'object') {
    errObj = body.data.errors;
  }
  if (!errObj || typeof errObj !== 'object') {
    return { fields: {}, general: null };
  }

  const fields = {};
  const generalParts = [];

  for (const [key, val] of Object.entries(errObj)) {
    const msg = firstMessage(val);
    if (!msg) continue;

    if (FORM_FIELDS.has(key)) {
      fields[key] = msg;
      continue;
    }

    if (key === 'detail') {
      generalParts.push(msg);
      continue;
    }

    if (key === 'non_field_errors') {
      generalParts.push(msg);
      continue;
    }

    generalParts.push(`${key}: ${msg}`);
  }

  return {
    fields,
    general: generalParts.length ? generalParts.join(' ') : null,
  };
}
