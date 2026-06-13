import api from '@/api';
import { unwrapListPayload, unwrapOnePayload } from '@/utils/unwrapList';

const BASE = '/designation-permission-profiles/';

export async function fetchDesignationPermissionProfiles(params = {}) {
  const { data } = await api.get(BASE, { params });
  return { data: unwrapListPayload(data) };
}

export async function createDesignationPermissionProfile(payload) {
  const { data } = await api.post(BASE, payload);
  return { data: unwrapOnePayload(data) };
}

export async function patchDesignationPermissionProfile(id, payload) {
  const { data } = await api.patch(`${BASE}${id}/`, payload);
  return { data: unwrapOnePayload(data) };
}
