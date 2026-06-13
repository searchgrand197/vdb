import { Alert, Box, Divider, List, ListItem, Typography } from '@mui/material';

const CODE_LABELS = {
  doctor_code: 'Doctor code',
};

function LinkedBlock({ title, items, codeKey }) {
  if (!items?.length) return null;
  const codeHuman = codeKey ? CODE_LABELS[codeKey] ?? codeKey : null;
  return (
    <Box sx={{ mt: 2 }}>
      <Divider sx={{ mb: 2 }} />
      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        {title} ({items.length})
      </Typography>
      <List dense disablePadding>
        {items.map((row) => (
          <ListItem key={row.id} disableGutters sx={{ py: 0.5, display: 'block', alignItems: 'stretch' }}>
            <Typography variant="body2" fontWeight={500}>
              {row.name ?? '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div">
              {codeKey && row[codeKey] != null && row[codeKey] !== ''
                ? `${codeHuman}: ${row[codeKey]} · `
                : null}
              id: {row.id}
            </Typography>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

/** Renders API conflict payload for specialty delete (linked doctors). */
export function SpecialtyDeleteConflict({ conflict }) {
  if (!conflict) return null;

  const { detail, linkedDoctors, linkedCounts, truncated } = conflict;

  const doctorsTruncated = truncated?.doctors === true;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {detail ? <Alert severity="warning">{detail}</Alert> : null}

      {linkedCounts ? (
        <Typography variant="body2" color="text.secondary">
          Summary — doctors: <strong>{linkedCounts.doctors ?? 0}</strong>
        </Typography>
      ) : null}

      {doctorsTruncated ? (
        <Typography variant="caption" color="warning.main">
          Some linked doctors may be truncated; reassign or remove records in the hospital system, then try
          again.
        </Typography>
      ) : null}

      <LinkedBlock title="Linked doctors" items={linkedDoctors} codeKey="doctor_code" />

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        After reassigning or removing these links, you can delete this specialty.
      </Typography>
    </Box>
  );
}
