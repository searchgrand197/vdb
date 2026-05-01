import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

/**
 * Dashboard statistic card — icon, value, label.
 * Used on dashboard pages across all portals.
 */
export function AppStatCard({ icon, value, label, color = 'primary', sx }) {
  return (
    <Card sx={{ height: '100%', ...sx }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {icon && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: `${color}.light`,
              color: `${color}.main`,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" fontWeight={700} lineHeight={1.2}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {label}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
