import api from '@/api';
import { unwrapListPayload, unwrapOnePayload } from '@/utils/unwrapList';

const BASE = '/specialties/';

export async function fetchSpecialties(params = {}) {
  const { data } = await api.get(BASE, { params });
  const rows = unwrapListPayload(data);
  return { data: rows };
}

export async function createSpecialty(payload) {
  const { data } = await api.post(BASE, payload);
  return { data: unwrapOnePayload(data) };
}

export async function patchSpecialty(id, payload) {
  const { data } = await api.patch(`${BASE}${id}/`, payload);
  return { data: unwrapOnePayload(data) };
}

export async function deleteSpecialty(id) {
  await api.delete(`${BASE}${id}/`);
}
