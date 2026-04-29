import Chip from '@mui/material/Chip';

const STATUS_MAP = {
  active: { label: 'Active', color: 'success' },
  inactive: { label: 'Inactive', color: 'default' },
  pending: { label: 'Pending', color: 'warning' },
  critical: { label: 'Critical', color: 'error' },
};

/** Small status chip for tables and detail headers. */
export function StatusBadge({ status }) {
  const key = (status || '').toLowerCase();
  const cfg = STATUS_MAP[key] || { label: status || '—', color: 'default' };
  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      size="small"
      variant={cfg.color === 'default' ? 'outlined' : 'filled'}
      sx={{ fontWeight: 500 }}
    />
  );
}
