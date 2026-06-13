import api from '@/api';
import { unwrapListPayload, unwrapOnePayload } from '@/utils/unwrapList';

const BASE = '/schemes/';

export async function fetchSchemes(params = {}) {
  const { data } = await api.get(BASE, { params });
  const rows = unwrapListPayload(data);
  return { data: rows };
}

export async function createScheme(payload) {
  const { data } = await api.post(BASE, payload);
  return { data: unwrapOnePayload(data) };
}

export async function patchScheme(id, payload) {
  const { data } = await api.patch(`${BASE}${id}/`, payload);
  return { data: unwrapOnePayload(data) };
}

export async function deleteScheme(id) {
  await api.delete(`${BASE}${id}/`);
}
