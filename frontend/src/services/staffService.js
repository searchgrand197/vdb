import api from '@/api';
import { unwrapListPayload, unwrapOnePayload } from '@/utils/unwrapList';

const BASE = '/staff/';

export async function fetchStaff(params = {}) {
  const { data } = await api.get(BASE, { params });
  const rows = unwrapListPayload(data);
  return { data: rows };
}

export async function createStaff(payload) {
  const { data } = await api.post(BASE, payload);
  return { data: unwrapOnePayload(data) };
}

export async function patchStaff(id, payload) {
  const { data } = await api.patch(`${BASE}${id}/`, payload);
  return { data: unwrapOnePayload(data) };
}

export async function deleteStaff(id) {
  await api.delete(`${BASE}${id}/`);
}

export async function patchStaffPharmacyAccess(id, pharmacyIds) {
  const { data } = await api.patch(`${BASE}${id}/`, {
    allowed_pharmacies: pharmacyIds,
  });
  return { data: unwrapOnePayload(data) };
}
