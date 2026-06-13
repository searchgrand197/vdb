import api from '@/api';
import { unwrapListPayload } from '@/utils/unwrapList';

/**
 * Active pharmacy branches (login picker + admin assignment).
 */
export async function fetchPharmacyBranches() {
  const { data } = await api.get('/auth/pharmacies/');
  const rows = unwrapListPayload(data);
  return { data: rows };
}
