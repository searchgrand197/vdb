import { Typography } from '@mui/material';
import { useAuth } from '@admin/context/AuthContext';

/** Landing view after login — replace with KPI widgets when requirements land. */
export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="row">
      <div className="col-12">
        <Typography variant="h5" className="mb-2">
          Welcome, {user?.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Use the sidebar to open modules. Menus and routes respect your current role.
        </Typography>
      </div>
    </div>
  );
}
