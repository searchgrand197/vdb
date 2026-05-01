import { Box, Typography } from '@mui/material';

/**
 * Placeholder screen for HMS API resources (see Postman collection / OpenAPI).
 * Superusers see every module in the sidebar; wire real UI per resource later.
 */
export function ApiModulePage({ title, apiListPath }) {
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        List endpoint (reference):
      </Typography>
      <Typography variant="body2" component="code" sx={{ wordBreak: 'break-all' }}>
        {apiListPath}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        UI for this module is not built yet — data will load from this API path.
      </Typography>
    </Box>
  );
}
