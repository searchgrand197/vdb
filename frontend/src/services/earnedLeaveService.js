import api from '@/api';
import { unwrapListPayload } from '@/utils/unwrapList';

const BASE = '/attendance/earned-leave-allocations/';

export async function fetchEarnedLeaveAllocations(params = {}) {
  const { data } = await api.get(BASE, { params });
  const rows = unwrapListPayload(data);
  return { data: rows };
}

export async function saveEarnedLeaveAllocations(allocations) {
  // Backend expects a single allocation dict per POST, not a list.
  // Send one POST per allocation object.
  const responses = await Promise.all(
    allocations.map((item) => api.post(BASE, item))
  );
  return { data: responses.map((r) => r.data) };
}
