import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import { ADMIN_ROUTES } from '@/constants/routes';
import { HMS_API_RESOURCES } from '@/constants/hmsApiNav';

/**
 * Sidebar: one entry per HMS API resource (+ dashboard).
 * Superusers pass all `userHasRole` checks; others use each row's `roles`.
 */
export const NAV_ITEMS = [
  {
    label: 'Dashboard',
    path: ADMIN_ROUTES.DASHBOARD,
    icon: DashboardOutlinedIcon,
    roles: [...new Set(HMS_API_RESOURCES.flatMap((r) => r.roles))],
  },
  ...HMS_API_RESOURCES.map((r) => ({
    label: r.title,
    path: `${ADMIN_ROUTES.DASHBOARD}/${r.segment}`,
    icon: r.Icon,
    roles: r.roles,
  })),
];
