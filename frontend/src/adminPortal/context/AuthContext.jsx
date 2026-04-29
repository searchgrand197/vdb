import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Admin AuthContext — bridges to the main project's localStorage keys.
 * Main project stores: access, refresh, role, user (JSON).
 * This context normalizes that data into the shape admin modules expect.
 */

const AuthContext = createContext(null);

/**
 * Normalize the stored user payload from main login into admin-expected shape.
 * Main Login stores: localStorage.setItem('user', JSON.stringify(payload))
 * where payload = data?.data || {} from the login API.
 */
function normalizeStoredUser(raw) {
  if (!raw) return null;
  const u = raw.user ?? raw.profile ?? raw;
  const isSuperuser = Boolean(u?.is_superuser ?? raw?.is_superuser);
  const isActive = u?.is_active ?? raw?.is_active;
  const isStaff = u?.is_staff ?? raw?.is_staff;

  const hospitalId =
    u?.hospital_id ??
    raw?.hospital_id ??
    u?.hospital?.id ??
    null;
  const hospitalName =
    u?.hospital_name ??
    raw?.hospital_name ??
    u?.hospital?.name ??
    null;

  const role = u?.role ?? raw?.role ?? u?.role_code ?? null;
  const email = u?.email ?? raw?.email ?? null;
  const id = u?.id ?? u?.pk ?? raw?.user_id ?? email ?? '';
  const name =
    [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim() ||
    u?.name ||
    u?.full_name ||
    email ||
    'User';

  return {
    id: String(id),
    email,
    name,
    role,
    is_active: isActive !== false,
    is_staff: isStaff !== false,
    is_superuser: isSuperuser,
    ...(hospitalId != null && hospitalId !== ''
      ? { hospital_id: String(hospitalId), hospital_name: hospitalName ?? null }
      : {}),
  };
}

/** Restore user after reload if we still have an access token in localStorage. */
function getInitialUser() {
  const access = localStorage.getItem('access');
  if (!access) return null;
  try {
    const raw = JSON.parse(localStorage.getItem('user') || 'null');
    return normalizeStoredUser(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getInitialUser());

  const logout = useCallback(async () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    localStorage.removeItem('pharmacy_branch_id');
    localStorage.removeItem('pharmacy_branch_label');
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user) && Boolean(localStorage.getItem('access')),
      login: async () => {
        // Login is handled by the main Login page; just re-read from storage
        const nextUser = getInitialUser();
        setUser(nextUser);
      },
      logout,
    }),
    [user, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
