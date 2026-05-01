/**
 * Pull a human-readable message from typical DRF / Axios error shapes.
 * @param {unknown} err
 */
export function getApiErrorMessage(err) {
  if (!err) return 'Something went wrong';
  if (typeof err === 'string') return err;
  const res = err.response?.data;
  if (typeof res === 'string') return res;
  if (res?.success === false && res?.errors?.detail != null) {
    return 'Your credentials are wrong.';
  }
  if (res?.message) return String(res.message);
  if (res?.detail) return String(res.detail);
  if (res?.error) return String(res.error);
  if (Array.isArray(res?.non_field_errors) && res.non_field_errors.length) {
    return String(res.non_field_errors[0]);
  }
  const firstKey = res && typeof res === 'object' ? Object.keys(res)[0] : null;
  if (firstKey) {
    const val = res[firstKey];
    if (Array.isArray(val) && val.length) return `${firstKey}: ${val[0]}`;
    if (typeof val === 'string') return `${firstKey}: ${val}`;
  }
  if (err.message) return err.message;
  return 'Request failed';
}
