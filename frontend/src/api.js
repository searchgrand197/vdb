import axios from 'axios';
import { useAuthStore } from './stores/authStore';

const api = axios.create({ baseURL: '/api/v1' });

// Helper – read selected pharmacy branch id
export function getPharmacyBranchId() {
  return useAuthStore.getState().pharmacyBranchId || null;
}

function readHospitalIdFromAccessToken() {
  try {
    const access = useAuthStore.getState().tokens?.access;
    if (!access || typeof access !== 'string') return null;
    const parts = access.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const hid = payload?.hospital_id;
    return hid != null && String(hid).trim() !== '' ? String(hid) : null;
  } catch {
    return null;
  }
}

// Helper – read hospital_id from the stored user object or JWT claim
export function getHospitalId() {
  const user = useAuthStore.getState().user;
  const fromUser = user?.hospital_id;
  if (fromUser != null && String(fromUser).trim() !== '') return String(fromUser);
  return readHospitalIdFromAccessToken();
}

api.interceptors.request.use(cfg => {
  const { tokens, role, pharmacyBranchId } = useAuthStore.getState();
  if (tokens.access) {
    cfg.headers.Authorization = `Bearer ${tokens.access}`;
  }

  // ── Pharmacy branch override ───────────────────────────────────────────
  const requestUrl = String(cfg.url || '');
  const isAuthRoute = requestUrl.startsWith('/auth/');
  if (role === 'pharmacy' && pharmacyBranchId) {
    cfg.headers['X-Pharmacy-Branch'] = pharmacyBranchId;
  } else if (role === 'pharmacy' && !pharmacyBranchId && !isAuthRoute) {
    throw new Error('Pharmacy branch is required. Please re-login and select a branch.');
  }

  const hospitalId = getHospitalId();
  const method = (cfg.method || '').toLowerCase();
  if (role !== 'pharmacy' && hospitalId && ['post', 'put', 'patch'].includes(method)) {
    if (cfg.data && typeof cfg.data === 'object' && !(cfg.data instanceof FormData)) {
      const existing = cfg.data.hospital_id;
      if (existing == null || String(existing).trim() === '') {
        cfg.data = { ...cfg.data, hospital_id: hospitalId };
      }
    }
  }

  return cfg;
});

let refreshPromise = null;

api.interceptors.response.use(
  r => r,
  async err => {
    const originalRequest = err.config;
    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const { tokens } = useAuthStore.getState();
      if (!tokens.refresh) {
        useAuthStore.getState().logoutSilent();
        window.location.replace('/login');
        return Promise.reject(err);
      }

      // Deduplicate: if a refresh is already in-flight, wait for it
      if (!refreshPromise) {
        refreshPromise = axios
          .post('/api/v1/auth/refresh/', { refresh: tokens.refresh })
          .then(({ data }) => {
            const access = data?.access || data?.data?.access;
            const newRefresh = data?.refresh || data?.data?.refresh;
            if (!access) throw new Error('No access token in refresh response');
            // Update Zustand store with new tokens
            useAuthStore.getState().setTokens(access, newRefresh);
            return access;
          })
          .catch(refreshErr => {
            useAuthStore.getState().logoutSilent();
            window.location.replace('/login');
            return Promise.reject(refreshErr);
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        const newAccess = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch {
        return Promise.reject(err);
      }
    }
    return Promise.reject(err);
  }
);

export default api;
