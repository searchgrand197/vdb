import api from '@/api';
import { unwrapListPayload, unwrapOnePayload } from '@/utils/unwrapList';

const BASE = '/modules/';

export async function fetchPermissionModules() {
  const { data } = await api.get(BASE);
  return { data: unwrapListPayload(data) };
}
