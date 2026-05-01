/**
 * Superusers bypass role lists. Otherwise checks `user.role` against allowed slugs.
 * @param {{ role?: string | null; is_superuser?: boolean } | string | null | undefined} userOrRole
 * @param {string[]} allowedRoles
 */
export function userHasRole(userOrRole, allowedRoles) {
  if (!allowedRoles?.length) return false;

  if (userOrRole && typeof userOrRole === 'object' && userOrRole.is_superuser) {
    return true;
  }

  const userRole = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}
