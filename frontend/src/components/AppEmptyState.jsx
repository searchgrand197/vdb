import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * Empty state placeholder — icon, message, optional action.
 * Replaces repeated "no data" patterns.
 */
export function AppEmptyState({ icon, message = 'No data found', action, sx }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        px: 2,
        textAlign: 'center',
        ...sx,
      }}
    >
      {icon && (
        <Box sx={{ mb: 2, color: 'text.secondary', opacity: 0.5 }}>
          {icon}
        </Box>
      )}
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
