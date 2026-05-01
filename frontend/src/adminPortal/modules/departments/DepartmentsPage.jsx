import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, CircularProgress, IconButton, Switch, FormControlLabel, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { useAuth } from '@admin/context/AuthContext';
import { useDepartmentsQuery, useDepartmentMutations } from '@/hooks/useDepartmentsQuery';
import { AppButton } from '@/components/AppButton';
import { AppTextField } from '@/components/AppTextField';
import { AppStatusBadge } from '@/components/AppStatusBadge';
import { AppTable } from '@/components/AppTable';
import { AppDialog } from '@/components/AppDialog';
import { useToast } from '@admin/context/ToastContext';
import { DepartmentDeleteConflict } from '@admin/modules/departments/DepartmentDeleteConflict';
import { departmentFormSchema } from '@admin/modules/departments/departmentSchema';
import { parseDepartmentDeleteError } from '@/utils/departmentDeleteError';
import { parseDepartmentFieldErrors } from '@/utils/departmentFormErrors';
import { getApiErrorMessage } from '@/utils/apiError';

const SORTABLE = [
  { id: 'name', label: 'Name', sortKey: 'name' },
  { id: 'code', label: 'Code', sortKey: 'code' },
  { id: 'description', label: 'Description', sortKey: 'description' },
  { id: 'status', label: 'Status', sortKey: 'status' },
];

function departmentRowMeta(raw) {
  const id = raw?.id ?? raw?.pk;
  const name = raw?.name ?? '—';
  const code = raw?.code ?? raw?.department_code ?? raw?.slug ?? '—';
  const description = (raw?.description ?? '').trim();
  const isActive = raw?.is_active !== false;
  return { id, name, code, description, isActive, raw };
}

/** Matches API body: name, code, description, is_active */
function toApiPayload(values) {
  return {
    name: values.name.trim(),
    code: values.code.trim(),
    description: (values.description ?? '').trim(),
    is_active: Boolean(values.is_active),
  };
}

function compareRows(a, b, sortKey, sortDir) {
  const ma = departmentRowMeta(a);
  const mb = departmentRowMeta(b);
  let cmp = 0;
  if (sortKey === 'name') {
    cmp = ma.name.localeCompare(mb.name, undefined, { sensitivity: 'base' });
  } else if (sortKey === 'code') {
    cmp = String(ma.code).localeCompare(String(mb.code), undefined, { sensitivity: 'base' });
  } else if (sortKey === 'description') {
    cmp = ma.description.localeCompare(mb.description, undefined, { sensitivity: 'base' });
  } else if (sortKey === 'status') {
    cmp = Number(ma.isActive) - Number(mb.isActive);
  }
  return sortDir === 'asc' ? cmp : -cmp;
}

const defaultFormValues = {
  name: '',
  code: '',
  description: '',
  is_active: true,
};

export function DepartmentsPage() {
  const { user } = useAuth();
  /** Full CRUD is reserved for Django superusers (see login `is_superuser`). */
  const canManage = user?.is_superuser === true;

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  /** Structured conflict from API (linked staff / doctors / specialties). */
  const [deleteConflict, setDeleteConflict] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const { showToast } = useToast();

  const { data, isLoading, isError, error } = useDepartmentsQuery();
  const { create, patch, remove } = useDepartmentMutations();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: defaultFormValues,
  });

  const filteredRows = useMemo(() => {
    const list = data?.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((raw) => {
      const m = departmentRowMeta(raw);
      return (
        m.name.toLowerCase().includes(q) ||
        String(m.code).toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
      );
    });
  }, [data?.data, search]);

  const rows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => compareRows(a, b, sortBy, sortDir));
    return copy;
  }, [filteredRows, sortBy, sortDir]);

  const requestSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const openCreate = () => {
    setFormMode('create');
    setEditingId(null);
    setFormError('');
    clearErrors();
    reset(defaultFormValues);
    setFormOpen(true);
  };

  const openEdit = (raw) => {
    const m = departmentRowMeta(raw);
    setFormMode('edit');
    setEditingId(m.id);
    setFormError('');
    clearErrors();
    reset({
      name: m.name === '—' ? '' : m.name,
      code: m.code === '—' ? '' : String(m.code),
      description: m.description,
      is_active: m.isActive,
    });
    setFormOpen(true);
  };

  const onFormClose = () => {
    setFormOpen(false);
    setEditingId(null);
    setFormError('');
    clearErrors();
  };

  const onSubmit = async (values) => {
    setFormError('');
    clearErrors();
    const payload = toApiPayload(values);
    try {
      if (formMode === 'create') {
        await create.mutateAsync(payload);
        showToast({ type: 'success', message: 'Department created' });
      } else if (editingId != null) {
        await patch.mutateAsync({ id: editingId, payload });
        showToast({ type: 'success', message: 'Department updated' });
      }
      onFormClose();
    } catch (e) {
      const { fields, general } = parseDepartmentFieldErrors(e);
      if (fields.name) setError('name', { type: 'server', message: fields.name });
      if (fields.code) setError('code', { type: 'server', message: fields.code });
      if (fields.description) setError('description', { type: 'server', message: fields.description });
      if (fields.is_active) setError('is_active', { type: 'server', message: fields.is_active });
      if (general) {
        setFormError(general);
      }
      if (!Object.keys(fields).length && !general) {
        setFormError(getApiErrorMessage(e));
      }
    }
  };

  const confirmDelete = async () => {
    if (deleteTarget == null) return;
    setDeleteError('');
    setDeleteConflict(null);
    try {
      await remove.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConflict(null);
      showToast({ type: 'success', message: 'Department deleted' });
    } catch (e) {
      const parsed = parseDepartmentDeleteError(e);
      if (parsed) {
        setDeleteConflict(parsed);
        setDeleteError('');
      } else {
        setDeleteConflict(null);
        setDeleteError(getApiErrorMessage(e));
      }
    }
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteConflict(null);
    setDeleteError('');
  };

  const saving = create.isPending || patch.isPending;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="h5">Departments</Typography>
        {canManage ? (
          <AppButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add department
          </AppButton>
        ) : null}
      </Box>

      <Box sx={{ maxWidth: { md: '50%', lg: '33.33%' } }}>
        <AppTextField
          label="Search"
          placeholder="Name, code, description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Box>

      {!canManage ? (
        <Alert severity="info">
          Only superusers can create, edit, or delete departments. You can view the list below.
        </Alert>
      ) : null}

      {formError && !formOpen ? (
        <Alert severity="error" onClose={() => setFormError('')}>
          {formError}
        </Alert>
      ) : null}

      <Box sx={{ position: 'relative' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress size={32} />
          </Box>
        ) : isError ? (
          <Typography color="error">{getApiErrorMessage(error)}</Typography>
        ) : (
          <AppTable
            columns={[
              {
                id: 'name',
                header: 'Name',
                renderCell: (raw) => departmentRowMeta(raw).name,
              },
              {
                id: 'code',
                header: 'Code',
                renderCell: (raw) => departmentRowMeta(raw).code,
              },
              {
                id: 'description',
                header: 'Description',
                renderCell: (raw) => {
                  const m = departmentRowMeta(raw);
                  return (
                    <Typography
                      variant="body2"
                      sx={{ maxWidth: 360, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {m.description || '—'}
                    </Typography>
                  );
                },
              },
              {
                id: 'status',
                header: 'Status',
                renderCell: (raw) => {
                  const m = departmentRowMeta(raw);
                  return <AppStatusBadge status={m.isActive ? 'active' : 'inactive'} />;
                },
              },
            ]}
            data={rows}
            emptyMessage="No departments found"
            getRowId={(raw) => departmentRowMeta(raw).id}
            renderActions={(raw) => {
              const m = departmentRowMeta(raw);
              return canManage ? (
                <>
                  <IconButton size="small" aria-label="Edit department" onClick={() => openEdit(raw)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Delete department"
                    onClick={() => {
                      setDeleteError('');
                      setDeleteConflict(null);
                      setDeleteTarget({ id: m.id, name: m.name });
                    }}
                  >
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </>
              ) : (
                '—'
              );
            }}
          />
        )}
      </Box>

      <AppDialog
        open={formOpen}
        onClose={saving ? () => {} : onFormClose}
        title={formMode === 'create' ? 'Add department' : 'Edit department'}
        maxWidth="sm"
        actions={
          <>
            <AppButton onClick={onFormClose} disabled={saving}>
              Cancel
            </AppButton>
            <AppButton variant="contained" onClick={handleSubmit(onSubmit)} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </AppButton>
          </>
        }
      >
        {formError ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError('')}>
            {formError}
          </Alert>
        ) : null}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <AppTextField
            label="Name"
            required
            {...register('name')}
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
          />
          <AppTextField
            label="Code"
            required
            placeholder="e.g. CARDIOLOGY"
            {...register('code')}
            error={Boolean(errors.code)}
            helperText={errors.code?.message}
          />
          <AppTextField
            label="Description"
            multiline
            minRows={2}
            {...register('description')}
            error={Boolean(errors.description)}
            helperText={errors.description?.message}
          />
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <Box>
                <FormControlLabel
                  control={<Switch checked={Boolean(field.value)} onChange={(_, v) => field.onChange(v)} />}
                  label="Active"
                />
                {errors.is_active?.message ? (
                  <Typography variant="caption" color="error" display="block">
                    {errors.is_active.message}
                  </Typography>
                ) : null}
              </Box>
            )}
          />
        </Box>
      </AppDialog>

      <AppDialog
        open={Boolean(deleteTarget)}
        onClose={remove.isPending ? () => {} : closeDeleteDialog}
        title={deleteConflict ? 'Cannot delete department' : 'Delete department'}
        maxWidth={deleteConflict ? 'md' : 'sm'}
        actions={
          deleteConflict ? (
            <AppButton variant="contained" onClick={closeDeleteDialog}>
              Close
            </AppButton>
          ) : (
            <>
              <AppButton onClick={closeDeleteDialog} disabled={remove.isPending}>
                Cancel
              </AppButton>
              <AppButton
                variant="contained"
                color="error"
                onClick={confirmDelete}
                disabled={remove.isPending}
              >
                {remove.isPending ? 'Deleting…' : 'Delete'}
              </AppButton>
            </>
          )
        }
      >
        {deleteConflict ? (
          <DepartmentDeleteConflict conflict={deleteConflict} />
        ) : (
          <>
            {deleteError ? (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDeleteError('')}>
                {deleteError}
              </Alert>
            ) : null}
            <Typography variant="body2">
              Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </Typography>
          </>
        )}
      </AppDialog>
    </Box>
  );
}
