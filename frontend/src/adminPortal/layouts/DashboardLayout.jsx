import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { NAV_ITEMS } from '@/constants/navigation';
import { useAuth } from '@admin/context/AuthContext';
import { userHasRole } from '@/utils/roleUtils';
import { AppButton } from '@/components/AppButton';

const DRAWER_WIDTH = 260;

export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleNav = NAV_ITEMS.filter((item) => userHasRole(user, item.roles));

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ px: 3, minHeight: 64 }}>
        <Typography variant="h6" noWrap component="div" color="primary">
          HMS Admin
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1, py: 2 }}>
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const adminPath = item.path;
          const selected =
            adminPath === '/admin'
              ? location.pathname === '/admin' || location.pathname === '/admin/'
              : location.pathname === adminPath || location.pathname.startsWith(`${adminPath}/`);
          return (
            <ListItemButton
              key={adminPath}
              component={RouterLink}
              to={adminPath}
              selected={selected}
              onClick={() => setMobileOpen(false)}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ p: 3 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          Signed in as
        </Typography>
        <Typography variant="body2" fontWeight={600} noWrap title={user?.name}>
          {user?.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {user?.role?.replace(/_/g, ' ')}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          color: 'text.primary',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 2, display: { md: 'none' } }}
            aria-label="open menu"
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Hospital Management — Admin
          </Typography>
          <AppButton
            variant="outlined"
            color="inherit"
            startIcon={<LogoutOutlinedIcon />}
            onClick={handleLogout}
          >
            Log out
          </AppButton>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: '64px',
          bgcolor: 'background.default',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Box sx={{ py: { xs: 3, md: 4 }, px: { xs: 2, md: 3 }, maxWidth: '100%' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
