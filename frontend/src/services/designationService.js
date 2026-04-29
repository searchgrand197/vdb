import api from '@/api';
import { unwrapListPayload, unwrapOnePayload } from '@/utils/unwrapList';

const BASE = '/designations/';

export async function fetchDesignations(params = {}) {
  const { data } = await api.get(BASE, { params });
  const rows = unwrapListPayload(data);
  return { data: rows };
}

export async function createDesignation(payload) {
  const { data } = await api.post(BASE, payload);
  return { data: unwrapOnePayload(data) };
}

export async function patchDesignation(id, payload) {
  const { data } = await api.patch(`${BASE}${id}/`, payload);
  return { data: unwrapOnePayload(data) };
}

export async function deleteDesignation(id) {
  await api.delete(`${BASE}${id}/`);
}
