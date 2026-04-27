import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })

function clearAuthStorage() {
  localStorage.removeItem('access')
  localStorage.removeItem('refresh')
  localStorage.removeItem('role')
  localStorage.removeItem('user')
  localStorage.removeItem('pharmacy_branch_id')
  localStorage.removeItem('pharmacy_branch_label')
}

// Helper – read selected pharmacy branch id (set on login when role=pharmacy)
export function getPharmacyBranchId() {
  return localStorage.getItem('pharmacy_branch_id') || null
}

// Helper – read hospital_id from the stored user object
export function getHospitalId() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user.hospital_id || null
  } catch {
    return null
  }
}

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access')
  if (token) cfg.headers.Authorization = `Bearer ${token}`

  // ── Pharmacy branch override ───────────────────────────────────────────
  // When role=pharmacy the user picks a branch on login. We send its ID as a
  // custom header so the backend middleware can scope all DB queries to that
  // specific pharmacy branch (Hospital row), regardless of which Hospital the
  // user account is linked to in the DB.
  const role = localStorage.getItem('role')
  const branchId = getPharmacyBranchId()
  if (role === 'pharmacy' && branchId) {
    cfg.headers['X-Pharmacy-Branch'] = branchId
  }

  const hospitalId = getHospitalId()
  if (hospitalId && ['post', 'put', 'patch'].includes((cfg.method || '').toLowerCase())) {
    if (cfg.data && typeof cfg.data === 'object' && !(cfg.data instanceof FormData)) {
      if (!cfg.data.hospital_id) {
        cfg.data = { ...cfg.data, hospital_id: hospitalId }
      }
    }
  }

  return cfg
})

let refreshPromise = null

api.interceptors.response.use(
  r => r,
  async err => {
    const originalRequest = err.config
    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refresh = localStorage.getItem('refresh')
      if (!refresh) {
        clearAuthStorage()
        window.location.href = '/login'
        return Promise.reject(err)
      }

      // Deduplicate: if a refresh is already in-flight, wait for it
      if (!refreshPromise) {
        refreshPromise = axios
          .post('/api/v1/auth/refresh/', { refresh })
          .then(({ data }) => {
            const access = data?.access || data?.data?.access
            const newRefresh = data?.refresh || data?.data?.refresh
            if (!access) throw new Error('No access token in refresh response')
            localStorage.setItem('access', access)
            if (newRefresh) localStorage.setItem('refresh', newRefresh)
            return access
          })
          .catch(refreshErr => {
            clearAuthStorage()
            window.location.href = '/login'
            return Promise.reject(refreshErr)
          })
          .finally(() => {
            refreshPromise = null
          })
      }

      try {
        const newAccess = await refreshPromise
        originalRequest.headers.Authorization = `Bearer ${newAccess}`
        return api(originalRequest)
      } catch {
        return Promise.reject(err)
      }
    }
    return Promise.reject(err)
  }
)

export default api
