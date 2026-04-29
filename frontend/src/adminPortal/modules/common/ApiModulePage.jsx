import { Typography } from '@mui/material';

/**
 * Placeholder screen for HMS API resources (see Postman collection / OpenAPI).
 * Superusers see every module in the sidebar; wire real UI per resource later.
 */
export function ApiModulePage({ title, apiListPath }) {
  return (
    <div className="row">
      <div className="col-12">
        <Typography variant="h5" className="mb-2">
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" className="mb-1">
          List endpoint (reference):
        </Typography>
        <Typography variant="body2" component="code" sx={{ wordBreak: 'break-all' }}>
          {apiListPath}
        </Typography>
        <Typography variant="body2" color="text.secondary" className="mt-3">
          UI for this module is not built yet — data will load from this API path.
        </Typography>
      </div>
    </div>
  );
}
