import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, CircularProgress, IconButton, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { useAuth } from '@admin/context/AuthContext';
import { useDesignationsQuery, useDesignationMutations } from '@/hooks/useDesignationsQuery';
import { AppButton } from '@admin/components/AppButton';
import { AppTextField } from '@admin/components/AppTextField';
import { CommonTable } from '@admin/components/common/CommonTable';
import { CommonDialog } from '@admin/components/common/CommonDialog';
import { useToast } from '@admin/context/ToastContext';
import { designationFormSchema } from '@admin/modules/designations/designationSchema';
import { DesignationDeleteConflict } from '@admin/modules/designations/DesignationDeleteConflict';
import { parseDesignationFieldErrors } from '@/utils/designationFormErrors';
import { parseDesignationDeleteError } from '@/utils/designationDeleteError';
import { getApiErrorMessage } from '@/utils/apiError';

function designationRowMeta(raw) {
  const id = raw?.id ?? raw?.pk;
  const name = raw?.name ?? '—';
  const code = raw?.code ?? raw?.designation_code ?? '—';
  const description = (raw?.description ?? '').trim();
  return { id, name, code, description, raw };
}

function toApiPayload(values) {
  return {
    name: values.name.trim(),
    code: values.code.trim(),
    description: (values.description ?? '').trim(),
  };
}

const defaultFormValues = {
  name: '',
  code: '',
  description: '',
};

export function DesignationsPage() {
  const { user } = useAuth();
  const canManage = user?.is_superuser === true;

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteConflict, setDeleteConflict] = useState(null);
  const { showToast } = useToast();

  const { data, isLoading, isError, error } = useDesignationsQuery();
  const { create, patch, remove } = useDesignationMutations();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(designationFormSchema),
    defaultValues: defaultFormValues,
  });

  const rows = useMemo(() => {
    const list = data?.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((raw) => {
      const m = designationRowMeta(raw);
      return (
        m.name.toLowerCase().includes(q) ||
        String(m.code).toLowerCase().includes(q) ||
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
    const m = designationRowMeta(raw);
    setFormMode('edit');
    setEditingId(m.id);
    setFormError('');
    clearErrors();
    reset({
      name: m.name === '—' ? '' : m.name,
      code: m.code === '—' ? '' : String(m.code),
      description: m.description,
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
        showToast({ type: 'success', message: 'Designation created' });
      } else if (editingId != null) {
        await patch.mutateAsync({ id: editingId, payload });
        showToast({ type: 'success', message: 'Designation updated' });
      }
      closeForm();
    } catch (e) {
      const { fields, general } = parseDesignationFieldErrors(e);
      if (fields.name) setError('name', { type: 'server', message: fields.name });
      if (fields.code) setError('code', { type: 'server', message: fields.code });
      if (fields.description) setError('description', { type: 'server', message: fields.description });
      if (general) setFormError(general);
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
      showToast({ type: 'success', message: 'Designation deleted' });
    } catch (e) {
      const parsed = parseDesignationDeleteError(e);
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
    <div className="row g-3">
      <div className="col-12 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <Typography variant="h5">Designations</Typography>
        {canManage ? (
          <AppButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add designation
          </AppButton>
        ) : null}
      </div>

      <div className="col-12 col-md-6 col-lg-4">
        <AppTextField
          label="Search"
          placeholder="Name, code, description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!canManage ? (
        <div className="col-12">
          <Alert severity="info">
            Only superusers can create, edit, or delete designations. You can view the list below.
          </Alert>
        </div>
      ) : null}

      {formError && !formOpen ? (
        <div className="col-12">
          <Alert severity="error" onClose={() => setFormError('')}>
            {formError}
          </Alert>
        </div>
      ) : null}

      <div className="col-12 position-relative">
        {isLoading ? (
          <div className="d-flex justify-content-center py-5">
            <CircularProgress size={32} />
          </div>
        ) : isError ? (
          <Typography color="error">{getApiErrorMessage(error)}</Typography>
        ) : (
          <CommonTable
            columns={[
              {
                id: 'name',
                header: 'Name',
                renderCell: (raw) => designationRowMeta(raw).name,
              },
              {
                id: 'code',
                header: 'Code',
                renderCell: (raw) => designationRowMeta(raw).code,
              },
              {
                id: 'description',
                header: 'Description',
                renderCell: (raw) => {
                  const m = designationRowMeta(raw);
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
            ]}
            data={rows}
            emptyMessage="No designations found"
            getRowId={(raw) => designationRowMeta(raw).id}
            renderActions={(raw) => {
              const m = designationRowMeta(raw);
              return canManage ? (
                <>
                  <IconButton size="small" aria-label="Edit designation" onClick={() => openEdit(raw)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Delete designation"
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
      </div>

      <CommonDialog
        open={formOpen}
        onClose={saving ? () => {} : closeForm}
        title={formMode === 'create' ? 'Add designation' : 'Edit designation'}
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
          <Alert severity="error" className="mb-2" onClose={() => setFormError('')}>
            {formError}
          </Alert>
        ) : null}
        <div className="d-flex flex-column gap-2 pt-1">
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
          <AppTextField
            label="Description"
            multiline
            minRows={2}
            {...register('description')}
            error={Boolean(errors.description)}
            helperText={errors.description?.message}
          />
        </div>
      </CommonDialog>

      <CommonDialog
        open={Boolean(deleteTarget)}
        onClose={remove.isPending ? () => {} : closeDeleteDialog}
        title={deleteConflict ? 'Cannot delete designation' : 'Delete designation'}
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
          <DesignationDeleteConflict conflict={deleteConflict} />
        ) : (
          <>
            {deleteError ? (
              <Alert severity="error" className="mb-2" onClose={() => setDeleteError('')}>
                {deleteError}
              </Alert>
            ) : null}
            <Typography variant="body2">
              Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </Typography>
          </>
        )}
      </CommonDialog>
    </div>
  );
}
