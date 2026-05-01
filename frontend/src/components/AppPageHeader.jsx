import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * Page header with title and optional action buttons.
 * Replaces the repeated title + button pattern across all portals.
 */
export function AppPageHeader({ title, subtitle, action, sx }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        mb: 3,
        ...sx,
      }}
    >
      <Box>
        <Typography variant="h5" fontWeight={600}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>{action}</Box>}
    </Box>
  );
}
