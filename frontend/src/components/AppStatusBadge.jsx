import Chip from '@mui/material/Chip';

const STATUS_MAP = {
  active: { label: 'Active', color: 'success' },
  inactive: { label: 'Inactive', color: 'default' },
  pending: { label: 'Pending', color: 'warning' },
  critical: { label: 'Critical', color: 'error' },
  completed: { label: 'Completed', color: 'info' },
  cancelled: { label: 'Cancelled', color: 'default' },
  // Staff portal statuses
  in_progress: { label: 'In Progress', color: 'info' },
  done: { label: 'Done', color: 'success' },
  skipped: { label: 'Skipped', color: 'default' },
  // Leave statuses
  approved: { label: 'Approved', color: 'success' },
  rejected: { label: 'Rejected', color: 'error' },
};

/** Small status chip for tables and detail headers. */
export function AppStatusBadge({ status }) {
  const key = (status || '').toLowerCase();
  const cfg = STATUS_MAP[key] || { label: status || '—', color: 'default' };
  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      size="small"
      variant={cfg.color === 'default' ? 'outlined' : 'filled'}
      sx={{ fontWeight: 500, textTransform: 'capitalize' }}
    />
  );
}
