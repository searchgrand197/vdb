/** Normalize common DRF / custom envelope list shapes to a plain array. */
export function unwrapListPayload(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  return [];
}

/** Single resource from detail or wrapped responses. */
export function unwrapOnePayload(data) {
  if (data?.data != null && typeof data.data === 'object' && !Array.isArray(data.data)) {
    return data.data;
  }
  return data;
}
