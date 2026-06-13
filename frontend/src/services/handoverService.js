import api from '@/api';
import { unwrapListPayload, unwrapOnePayload } from '@/utils/unwrapList';

export async function fetchHandoverBalance() {
  const { data } = await api.get('/handovers/balance/');
  return unwrapOnePayload(data) || {};
}

export async function fetchPendingHandovers() {
  const { data } = await api.get('/handovers/pending/');
  return unwrapListPayload(data);
}

export async function verifyHandover(handoverId, action) {
  const { data } = await api.post('/handovers/verify/', {
    handover_id: handoverId,
    action,
  });
  return unwrapOnePayload(data);
}

export async function fetchHospitalCollection({ dateFrom, dateTo } = {}) {
  const params = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  const { data } = await api.get('/handovers/hospital-collection/', { params });
  return unwrapOnePayload(data) || {};
}
