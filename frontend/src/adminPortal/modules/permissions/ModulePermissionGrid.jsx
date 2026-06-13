import { Checkbox, TableCell, TableRow } from '@mui/material';

const FLAG_FIELDS = [
  { key: 'can_view', label: 'View' },
  { key: 'can_add', label: 'Add' },
  { key: 'can_edit', label: 'Edit' },
  { key: 'can_delete', label: 'Delete' },
  { key: 'can_print', label: 'Print' },
  { key: 'can_download', label: 'Download' },
];

export function buildEmptyModulePermissionRows(modules = []) {
  return modules.map((module) => ({
    module: module.id,
    module_code: module.code,
    module_name: module.name,
    can_view: false,
    can_add: false,
    can_edit: false,
    can_delete: false,
    can_print: false,
    can_download: false,
    is_active: true,
  }));
}

export function mergeModulePermissionRows(modules = [], existingLinks = []) {
  const byModuleId = new Map(
    (existingLinks || []).map((link) => [String(link.module), link])
  );

  return modules.map((module) => {
    const existing = byModuleId.get(String(module.id));
    if (!existing) {
      return {
        module: module.id,
        module_code: module.code,
        module_name: module.name,
        can_view: false,
        can_add: false,
        can_edit: false,
        can_delete: false,
        can_print: false,
        can_download: false,
        is_active: true,
      };
    }

    return {
      module: module.id,
      module_code: existing.module_code || module.code,
      module_name: existing.module_name || module.name,
      can_view: Boolean(existing.can_view),
      can_add: Boolean(existing.can_add),
      can_edit: Boolean(existing.can_edit),
      can_delete: Boolean(existing.can_delete),
      can_print: Boolean(existing.can_print),
      can_download: Boolean(existing.can_download),
      is_active: existing.is_active !== false,
    };
  });
}

export function modulePermissionRowsToPayload(rows = []) {
  return rows
    .filter((row) =>
      FLAG_FIELDS.some(({ key }) => Boolean(row[key])) || row.is_active === false
    )
    .map((row) => ({
      module: row.module,
      can_view: Boolean(row.can_view),
      can_add: Boolean(row.can_add),
      can_edit: Boolean(row.can_edit),
      can_delete: Boolean(row.can_delete),
      can_print: Boolean(row.can_print),
      can_download: Boolean(row.can_download),
      is_active: row.is_active !== false,
    }));
}

export function ModulePermissionGrid({ rows, onChange, disabled = false }) {
  const handleToggle = (rowIndex, field) => {
    if (disabled) return;
    onChange(
      rows.map((row, index) =>
        index === rowIndex ? { ...row, [field]: !row[field] } : row
      )
    );
  };

  return rows.map((row, rowIndex) => (
    <TableRow key={String(row.module)}>
      <TableCell>
        <div style={{ fontWeight: 600 }}>{row.module_name}</div>
        <span style={{ fontSize: 12, color: '#64748b' }}>{row.module_code}</span>
      </TableCell>
      {FLAG_FIELDS.map(({ key, label }) => (
        <TableCell key={key} align="center">
          <Checkbox
            size="small"
            checked={Boolean(row[key])}
            disabled={disabled}
            inputProps={{ 'aria-label': `${row.module_name} ${label}` }}
            onChange={() => handleToggle(rowIndex, key)}
          />
        </TableCell>
      ))}
    </TableRow>
  ));
}

export const MODULE_PERMISSION_COLUMNS = FLAG_FIELDS;
