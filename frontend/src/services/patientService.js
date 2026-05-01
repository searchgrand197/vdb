import api from '@/api';
import { unwrapListPayload, unwrapOnePayload } from '@/utils/unwrapList';

const BASE = '/patients/';

/**
 * GET /patients with optional server-side filters.
 * @param {{ search?: string; status?: string }} params
 */
export async function fetchPatients(params = {}) {
  const { data } = await api.get(BASE, { params });
  const rows = unwrapListPayload(data);
  return { data: rows };
}

/**
 * POST /patients
 * @param {object} payload
 */
export async function createPatient(payload) {
  const { data } = await api.post(BASE, payload);
  return { data: unwrapOnePayload(data) };
}
