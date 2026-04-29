import { Alert, Box, Divider, List, ListItem, Typography } from '@mui/material';

const CODE_LABELS = {
  employee_code: 'Employee code',
  doctor_code: 'Doctor code',
  code: 'Code',
};

function LinkedBlock({ title, items, codeKey }) {
  if (!items?.length) return null;
  const codeHuman = codeKey ? CODE_LABELS[codeKey] ?? codeKey : null;
  return (
    <Box className="mt-2">
      <Divider className="mb-2" />
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

/** Renders API conflict payload for department delete (linked staff, doctors, specialties). */
export function DepartmentDeleteConflict({ conflict }) {
  if (!conflict) return null;

  const { detail, linkedStaff, linkedDoctors, linkedSpecialties, linkedCounts, truncated } = conflict;

  const anyTruncated =
    truncated && (truncated.staff === true || truncated.doctors === true || truncated.specialties === true);

  return (
    <Box className="d-flex flex-column gap-1">
      {detail ? <Alert severity="warning">{detail}</Alert> : null}

      {linkedCounts ? (
        <Typography variant="body2" color="text.secondary">
          Summary — staff: <strong>{linkedCounts.staff ?? 0}</strong>, doctors:{' '}
          <strong>{linkedCounts.doctors ?? 0}</strong>, specialties:{' '}
          <strong>{linkedCounts.specialties ?? 0}</strong>
        </Typography>
      ) : null}

      {anyTruncated ? (
        <Typography variant="caption" color="warning.main">
          Some linked lists may be truncated; reassign or remove records in the hospital system, then try
          again.
        </Typography>
      ) : null}

      <LinkedBlock title="Linked staff" items={linkedStaff} codeKey="employee_code" />
      <LinkedBlock title="Linked doctors" items={linkedDoctors} codeKey="doctor_code" />
      <LinkedBlock title="Linked specialties" items={linkedSpecialties} codeKey="code" />

      <Typography variant="body2" color="text.secondary" className="mt-2">
        After reassigning or removing these links, you can delete this department.
      </Typography>
    </Box>
  );
}
