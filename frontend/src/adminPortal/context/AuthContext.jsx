import { useAuthStore } from '../../stores/authStore';

/**
 * Admin AuthContext — now backed by Zustand authStore.
 * Provides the same interface that admin modules expect:
 * { user, isAuthenticated, login, logout }
 *
 * No React Context Provider needed — Zustand works outside React.
 */
export function AuthProvider({ children }) {
  // Zustand doesn't need a Provider, just render children directly
  return children;
}

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => Boolean(s.tokens.access));
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);

  return { user, isAuthenticated, login, logout };
}
