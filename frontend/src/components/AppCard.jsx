import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

/**
 * Themed card with optional title, subtitle, actions.
 * Used across all portals for consistent card styling.
 */
export function AppCard({ title, subtitle, children, actions, sx, ...props }) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...sx }} {...props}>
      {(title || subtitle) && (
        <CardContent sx={{ pb: title && actions ? 1 : 2 }}>
          {title && (
            <Typography variant="h6" gutterBottom={!subtitle}>
              {title}
            </Typography>
          )}
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </CardContent>
      )}
      <Box sx={{ flexGrow: 1, px: 2, pb: actions ? 1 : 2 }}>
        {children}
      </Box>
      {actions && <CardActions sx={{ px: 2, pb: 2 }}>{actions}</CardActions>}
    </Card>
  );
}
