import { Navigate } from 'react-router-dom';
import { useAuth } from '@admin/context/AuthContext';
import { userHasRole } from '@/utils/roleUtils';

/**
 * Wraps a single route element; redirects to admin dashboard if role not allowed.
 * @param {{ children: React.ReactNode; allowedRoles: string[] }} props
 */
export function RoleRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  if (!userHasRole(user, allowedRoles)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
