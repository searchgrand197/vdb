import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, CircularProgress, IconButton, Switch, FormControlLabel, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { useAuth } from '@admin/context/AuthContext';
import { useSchemesQuery, useSchemeMutations } from '@/hooks/useSchemesQuery';
import { AppButton } from '@/components/AppButton';
import { AppTextField } from '@/components/AppTextField';
import { AppStatusBadge } from '@/components/AppStatusBadge';
import { AppTable } from '@/components/AppTable';
import { AppDialog } from '@/components/AppDialog';
import { useToast } from '@admin/context/ToastContext';
import { schemeFormSchema } from '@admin/modules/schemes/schemeSchema';
import { getApiErrorMessage } from '@/utils/apiError';
import { ROLES } from '@/constants/roles';

function schemeRowMeta(raw) {
  const id = raw?.id ?? raw?.pk;
  const name = raw?.name ?? '—';
  const description = (raw?.description ?? '').trim();
  const isActive = raw?.is_active !== false;
  return { id, name, description, isActive, raw };
}

function toApiPayload(values) {
  return {
    name: values.name.trim(),
    description: (values.description ?? '').trim(),
    is_active: Boolean(values.is_active),
  };
}

const defaultFormValues = {
  name: '',
  description: '',
  is_active: true,
};

export function SchemesPage() {
  const { user } = useAuth();
  const canManage = user?.is_superuser === true || user?.role === ROLES.HOSPITAL_ADMIN;

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const { showToast } = useToast();

  const { data, isLoading, isError, error } = useSchemesQuery({ all: true });
  const { create, patch, remove } = useSchemeMutations();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schemeFormSchema),
    defaultValues: defaultFormValues,
  });

  const filteredRows = useMemo(() => {
    const list = data?.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((raw) => {
      const m = schemeRowMeta(raw);
      return (
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
      );
    });
  }, [data?.data, search]);

  const openCreate = () => {
    setFormMode('create');
    setEditingId(null);
    setFormError('');
    clearErrors();
    reset(defaultFormValues);
    setFormOpen(true);
  };

  const openEdit = (raw) => {
    const m = schemeRowMeta(raw);
    setFormMode('edit');
    setEditingId(m.id);
    setFormError('');
    clearErrors();
    reset({
      name: m.name === '—' ? '' : m.name,
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
        showToast({ type: 'success', message: 'Scheme created' });
      } else if (editingId != null) {
        await patch.mutateAsync({ id: editingId, payload });
        showToast({ type: 'success', message: 'Scheme updated' });
      }
      onFormClose();
    } catch (e) {
      const detail = getApiErrorMessage(e);
      if (detail.toLowerCase().includes('name')) {
        setError('name', { type: 'server', message: detail });
      } else {
        setFormError(detail);
      }
    }
  };

  const confirmDelete = async () => {
    if (deleteTarget == null) return;
    setDeleteError('');
    try {
      await remove.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      showToast({ type: 'success', message: 'Scheme deleted' });
    } catch (e) {
      setDeleteError(getApiErrorMessage(e));
    }
  };

  const saving = create.isPending || patch.isPending;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="h5">Schemes</Typography>
        {canManage ? (
          <AppButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add scheme
          </AppButton>
        ) : null}
      </Box>

      <Box sx={{ maxWidth: { md: '50%', lg: '33.33%' } }}>
        <AppTextField
          label="Search"
          placeholder="Name or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Box>

      {!canManage ? (
        <Alert severity="info">
          Only admins can create, edit, or delete schemes. You can view the list below.
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
                renderCell: (raw) => schemeRowMeta(raw).name,
              },
              {
                id: 'description',
                header: 'Description',
                renderCell: (raw) => {
                  const m = schemeRowMeta(raw);
                  return (
                    <Typography
                      variant="body2"
                      sx={{ maxWidth: 480, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
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
                  const m = schemeRowMeta(raw);
                  return <AppStatusBadge status={m.isActive ? 'active' : 'inactive'} />;
                },
              },
            ]}
            data={filteredRows}
            emptyMessage="No schemes found"
            getRowId={(raw) => schemeRowMeta(raw).id}
            renderActions={(raw) => {
              const m = schemeRowMeta(raw);
              return canManage ? (
                <>
                  <IconButton size="small" aria-label="Edit scheme" onClick={() => openEdit(raw)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Delete scheme"
                    onClick={() => {
                      setDeleteError('');
                      setDeleteTarget({ id: m.id, name: m.name });
                    }}
                  >
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </>
              ) : null;
            }}
          />
        )}
      </Box>

      <AppDialog
        open={formOpen}
        onClose={onFormClose}
        title={formMode === 'create' ? 'Add scheme' : 'Edit scheme'}
        maxWidth="sm"
        fullWidth
      >
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {formError ? <Alert severity="error">{formError}</Alert> : null}
          <AppTextField
            label="Name"
            {...register('name')}
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
            required
          />
          <AppTextField
            label="Description"
            {...register('description')}
            multiline
            minRows={2}
            error={Boolean(errors.description)}
            helperText={errors.description?.message}
          />
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Active"
              />
            )}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
            <AppButton variant="outlined" onClick={onFormClose} disabled={saving}>
              Cancel
            </AppButton>
            <AppButton type="submit" variant="contained" disabled={saving}>
              {saving ? 'Saving…' : formMode === 'create' ? 'Create' : 'Save'}
            </AppButton>
          </Box>
        </Box>
      </AppDialog>

      <AppDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        title="Delete scheme"
        maxWidth="xs"
        fullWidth
      >
        <Typography variant="body2" sx={{ mb: 2 }}>
          Delete scheme <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </Typography>
        {deleteError ? <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert> : null}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <AppButton variant="outlined" onClick={() => setDeleteTarget(null)} disabled={remove.isPending}>
            Cancel
          </AppButton>
          <AppButton variant="contained" color="error" onClick={confirmDelete} disabled={remove.isPending}>
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </AppButton>
        </Box>
      </AppDialog>
    </Box>
  );
}
