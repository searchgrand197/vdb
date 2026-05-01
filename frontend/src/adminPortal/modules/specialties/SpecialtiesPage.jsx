import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, CircularProgress, IconButton, MenuItem, Switch, FormControlLabel, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { useAuth } from '@admin/context/AuthContext';
import { useDepartmentsQuery } from '@/hooks/useDepartmentsQuery';
import { useSpecialtiesQuery, useSpecialtyMutations } from '@/hooks/useSpecialtiesQuery';
import { AppButton } from '@/components/AppButton';
import { AppTextField } from '@/components/AppTextField';
import { AppSelect } from '@/components/AppSelect';
import { AppStatusBadge } from '@/components/AppStatusBadge';
import { AppTable } from '@/components/AppTable';
import { AppDialog } from '@/components/AppDialog';
import { useToast } from '@admin/context/ToastContext';
import { specialtyFormSchema } from '@admin/modules/specialties/specialtySchema';
import { parseSpecialtyFieldErrors } from '@/utils/specialtyFormErrors';
import { getApiErrorMessage } from '@/utils/apiError';

function specialtyRowMeta(raw, departmentLookup) {
  const id = raw?.id ?? raw?.pk;
  const name = raw?.name ?? '—';
  const code = raw?.code ?? raw?.specialty_code ?? '—';
  const description = (raw?.description ?? '').trim();
  const isActive = raw?.is_active !== false;
  const departmentId = raw?.department ?? null;
  const departmentName = departmentId && departmentLookup[departmentId] ? departmentLookup[departmentId] : null;
  return { id, name, code, description, isActive, departmentId, departmentName, raw };
}

function toApiPayload(values) {
  return {
    name: values.name.trim(),
    code: values.code.trim(),
    department: values.department,
    description: (values.description ?? '').trim(),
    is_active: values.is_active !== false,
  };
}

const defaultFormValues = {
  name: '',
  code: '',
  department: '',
  description: '',
  is_active: true,
};

export function SpecialtiesPage() {
  const { user } = useAuth();
  const canManage = user?.is_superuser === true;

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const { showToast } = useToast();

  const { data, isLoading, isError, error } = useSpecialtiesQuery();
  const { create, patch, remove } = useSpecialtyMutations();
  const { data: deptData } = useDepartmentsQuery();

  const departmentOptions = useMemo(() => {
    const raw = deptData?.data ?? [];
    return raw
      .map((d) => ({
        id: d?.id ?? d?.pk,
        name: d?.name ?? '—',
      }))
      .filter((d) => d.id != null);
  }, [deptData?.data]);

  const departmentLookup = useMemo(() => {
    const map = {};
    for (const d of departmentOptions) {
      map[d.id] = d.name;
    }
    return map;
  }, [departmentOptions]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(specialtyFormSchema),
    defaultValues: defaultFormValues,
  });

  const rows = useMemo(() => {
    const list = data?.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((raw) => {
      const m = specialtyRowMeta(raw, departmentLookup);
      return (
        m.name.toLowerCase().includes(q) ||
        String(m.code).toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
      );
    });
  }, [data?.data, departmentLookup, search]);

  const openCreate = () => {
    setFormMode('create');
    setEditingId(null);
    setFormError('');
    clearErrors();
    reset(defaultFormValues);
    setFormOpen(true);
  };

  const openEdit = (raw) => {
    const m = specialtyRowMeta(raw, departmentLookup);
    setFormMode('edit');
    setEditingId(m.id);
    setFormError('');
    clearErrors();
    reset({
      name: m.name === '—' ? '' : m.name,
      code: m.code === '—' ? '' : String(m.code),
      department: m.departmentId != null ? String(m.departmentId) : '',
      description: m.description,
      is_active: m.isActive,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
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
        showToast({ type: 'success', message: 'Specialty created' });
      } else if (editingId != null) {
        await patch.mutateAsync({ id: editingId, payload });
        showToast({ type: 'success', message: 'Specialty updated' });
      }
      closeForm();
    } catch (e) {
      const { fields, general } = parseSpecialtyFieldErrors(e);
      if (fields.name) setError('name', { type: 'server', message: fields.name });
      if (fields.code) setError('code', { type: 'server', message: fields.code });
      if (fields.department) setError('department', { type: 'server', message: fields.department });
      if (fields.description) setError('description', { type: 'server', message: fields.description });
      if (fields.is_active) setError('is_active', { type: 'server', message: fields.is_active });
      if (general) setFormError(general);
      if (!Object.keys(fields).length && !general) {
        setFormError(getApiErrorMessage(e));
      }
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      await remove.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      showToast({ type: 'success', message: 'Specialty deleted' });
    } catch (e) {
      setDeleteError(getApiErrorMessage(e));
    }
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteError('');
  };

  const saving = create.isPending || patch.isPending;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="h5">Specialties</Typography>
        {canManage ? (
          <AppButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add specialty
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
        <Box>
          <Alert severity="info">
            Only superusers can create, edit, or delete specialties. You can view the list below.
          </Alert>
        </Box>
      ) : null}

      {formError && !formOpen ? (
        <Box>
          <Alert severity="error" onClose={() => setFormError('')}>
            {formError}
          </Alert>
        </Box>
      ) : null}

      {isError ? (
        <Box>
          <Alert severity="error">{getApiErrorMessage(error)}</Alert>
        </Box>
      ) : null}

      <Box sx={{ position: 'relative' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <AppTable
            columns={[
              {
                id: 'name',
                header: 'Name',
                renderCell: (raw) => specialtyRowMeta(raw, departmentLookup).name,
              },
              {
                id: 'code',
                header: 'Code',
                renderCell: (raw) => specialtyRowMeta(raw, departmentLookup).code,
              },
              {
                id: 'department',
                header: 'Department',
                renderCell: (raw) => {
                  const m = specialtyRowMeta(raw, departmentLookup);
                  return m.departmentName || '—';
                },
              },
              {
                id: 'description',
                header: 'Description',
                renderCell: (raw) => {
                  const m = specialtyRowMeta(raw, departmentLookup);
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
                  const m = specialtyRowMeta(raw, departmentLookup);
                  return <AppStatusBadge status={m.isActive ? 'active' : 'inactive'} />;
                },
              },
            ]}
            data={rows}
            emptyMessage="No specialties found"
            getRowId={(raw) => specialtyRowMeta(raw, departmentLookup).id}
            renderActions={(raw) =>
              canManage ? (
                <>
                  <IconButton size="small" aria-label="Edit specialty" onClick={() => openEdit(raw)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Delete specialty"
                    onClick={() => {
                      setDeleteError('');
                      const m = specialtyRowMeta(raw, departmentLookup);
                      setDeleteTarget({ id: m.id, name: m.name });
                    }}
                  >
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </>
              ) : (
                '—'
              )
            }
          />
        )}
      </Box>

      <AppDialog
        open={formOpen}
        onClose={saving ? () => {} : closeForm}
        title={formMode === 'create' ? 'Add specialty' : 'Edit specialty'}
        maxWidth="sm"
        actions={
          <>
            <AppButton onClick={closeForm} disabled={saving}>
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
            {...register('code')}
            error={Boolean(errors.code)}
            helperText={errors.code?.message}
          />
          <Controller
            name="department"
            control={control}
            render={({ field, fieldState }) => (
              <AppSelect
                label="Department"
                id="department"
                {...field}
                error={fieldState.error}
              >
                {departmentOptions.map((d) => (
                  <MenuItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </MenuItem>
                ))}
              </AppSelect>
            )}
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
        title="Delete specialty"
        maxWidth="sm"
        actions={
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
        }
      >
        {deleteError ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDeleteError('')}>
            {deleteError}
          </Alert>
        ) : null}
        <Typography variant="body2">
          Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </Typography>
      </AppDialog>
    </Box>
  );
}

