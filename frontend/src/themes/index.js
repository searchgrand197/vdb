export { baseTheme } from './baseTheme';
export { adminTheme } from './adminTheme';
export { doctorTheme } from './doctorTheme';
export { receptionistTheme } from './receptionistTheme';
export { pharmacyTheme } from './pharmacyTheme';
export { staffTheme } from './staffTheme';
export { labTheme } from './labTheme';

import { baseTheme } from './baseTheme';
import { adminTheme } from './adminTheme';
import { doctorTheme } from './doctorTheme';
import { receptionistTheme } from './receptionistTheme';
import { pharmacyTheme } from './pharmacyTheme';
import { staffTheme } from './staffTheme';
import { labTheme } from './labTheme';

const portalThemes = {
  admin: adminTheme,
  doctor: doctorTheme,
  receptionist: receptionistTheme,
  pharmacy: pharmacyTheme,
  staff: staffTheme,
  lab: labTheme,
};

/**
 * Get the MUI theme for a given portal/role.
 * Falls back to baseTheme if the portal is not found.
 * @param {string} portal — 'admin' | 'doctor' | 'receptionist' | 'pharmacy' | 'staff' | 'lab'
 */
export function getThemeForPortal(portal) {
  return portalThemes[portal] || baseTheme;
}

/**
 * Resolve the portal key from the current URL pathname.
 * @param {string} pathname
 */
export function resolvePortalFromPath(pathname) {
  const segment = (pathname || '/').split('/').filter(Boolean)[0];
  if (segment === 'admin') return 'admin';
  if (segment === 'doctor') return 'doctor';
  if (segment === 'receptionist' || segment === 'reception') return 'receptionist';
  if (segment === 'pharmacy') return 'pharmacy';
  if (segment === 'lab') return 'lab';
  if (segment === 'staff') return 'staff';
  return null;
}
