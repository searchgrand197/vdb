import { Alert, Box, Divider, List, ListItem, Typography } from '@mui/material';

/** Renders API conflict payload for designation delete (linked staff). */
export function DesignationDeleteConflict({ conflict }) {
  if (!conflict) return null;

  const { detail, linkedStaff, linkedCounts, truncated } = conflict;

  const staffTruncated = truncated?.staff === true;

  return (
    <Box className="d-flex flex-column gap-1">
      {detail ? <Alert severity="warning">{detail}</Alert> : null}

      {linkedCounts ? (
        <Typography variant="body2" color="text.secondary">
          Summary — staff: <strong>{linkedCounts.staff ?? 0}</strong>
        </Typography>
      ) : null}

      {staffTruncated ? (
        <Typography variant="caption" color="warning.main">
          Some linked staff may be truncated; reassign or update records in the hospital system, then try
          again.
        </Typography>
      ) : null}

      {linkedStaff?.length ? (
        <Box className="mt-2">
          <Divider className="mb-2" />
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Linked staff ({linkedStaff.length})
          </Typography>
          <List dense disablePadding>
            {linkedStaff.map((row) => {
              const meta = [];
              if (row.employee_code != null && String(row.employee_code).trim() !== '') {
                meta.push(`Employee code: ${row.employee_code}`);
              }
              if (row.user_email) {
                meta.push(`Email: ${row.user_email}`);
              }
              meta.push(`id: ${row.id}`);
              return (
                <ListItem key={row.id} disableGutters sx={{ py: 0.5, display: 'block', alignItems: 'stretch' }}>
                  <Typography variant="body2" fontWeight={500}>
                    {row.name ?? '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {meta.join(' · ')}
                  </Typography>
                </ListItem>
              );
            })}
          </List>
        </Box>
      ) : null}

      <Typography variant="body2" color="text.secondary" className="mt-2">
        After reassigning or updating those staff records, you can delete this designation.
      </Typography>
    </Box>
  );
}
