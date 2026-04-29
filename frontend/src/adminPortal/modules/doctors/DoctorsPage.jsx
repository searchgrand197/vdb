import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { useDoctorsQuery, useDoctorMutations } from '@/hooks/useDoctorsQuery';
import { useDepartmentsQuery } from '@/hooks/useDepartmentsQuery';
import { useSpecialtiesQuery } from '@/hooks/useSpecialtiesQuery';
import { AppButton } from '@admin/components/AppButton';
import { AppTextField } from '@admin/components/AppTextField';
import { AppSelect } from '@admin/components/AppSelect';
import { CommonTable } from '@admin/components/common/CommonTable';
import { CommonDialog } from '@admin/components/common/CommonDialog';
import { StatusBadge } from '@admin/components/StatusBadge';
import { useToast } from '@admin/context/ToastContext';
import { doctorFormSchema } from '@admin/modules/doctors/doctorSchema';
import { getApiErrorMessage } from '@/utils/apiError';

function doctorRowMeta(raw, departmentLookup, specialtyLookup) {
  const id = raw?.id ?? raw?.pk;
  const name = raw?.name ?? '—';
  const code = raw?.doctor_code ?? raw?.code ?? '—';
  const mobile = raw?.mobile_number ?? '—';
  const fee = raw?.consultation_fee ?? '';
  const isActive = raw?.is_active !== false;

  const departmentIds = Array.isArray(raw?.departments) ? raw.departments : [];
  const departments = departmentIds
    .map((d) => departmentLookup[d])
    .filter(Boolean);

  const specialtyId = raw?.specialty ?? null;
  const specialty =
    (specialtyId && specialtyLookup[specialtyId]) || null;

  return {
    id,
    name,
    code,
    mobile,
    fee,
    isActive,
    departments,
    specialty,
    raw,
  };
}

function toApiPayload(values) {
  return {
    user: null,
    departments: values.departments,
    specialty: values.specialty,
    doctor_type: values.doctor_type,
    doctor_code: values.doctor_code.trim(),
    name: values.name.trim(),
    mobile_number: values.mobile_number.trim(),
    alternate_mobile_number: (values.alternate_mobile_number ?? '').trim() || '',
    address: (values.address ?? '').trim(),
    consultation_fee: (values.consultation_fee ?? '').trim(),
    is_active: values.is_active !== false,
  };
}

const defaultFormValues = {
  doctor_code: '',
  name: '',
  doctor_type: 'consultant',
  departments: [],
  specialty: '',
  mobile_number: '',
  alternate_mobile_number: '',
  address: '',
  consultation_fee: '',
  is_active: true,
};

export function DoctorsPage() {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const { showToast } = useToast();

  const { data, isLoading, isError, error } = useDoctorsQuery();
  const { create, patch, remove } = useDoctorMutations();

  const { data: deptData } = useDepartmentsQuery();
  const { data: specialtyData } = useSpecialtiesQuery();

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

  const specialtyOptions = useMemo(() => {
    const raw = specialtyData?.data ?? [];
    return raw
      .map((s) => ({
        id: s?.id ?? s?.pk,
        name: s?.name ?? '—',
      }))
      .filter((s) => s.id != null);
  }, [specialtyData?.data]);

  const specialtyLookup = useMemo(() => {
    const map = {};
    for (const s of specialtyOptions) {
      map[s.id] = s.name;
    }
    return map;
  }, [specialtyOptions]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(doctorFormSchema),
    defaultValues: defaultFormValues,
  });

  const rows = useMemo(() => {
    const list = data?.data ?? [];
    const q = search.trim().toLowerCase();
    const mapped = list.map((raw) => doctorRowMeta(raw, departmentLookup, specialtyLookup));
    if (!q) return mapped;
    return mapped.filter((row) => {
      const deptNames = row.departments.join(', ').toLowerCase();
      const spec = (row.specialty ?? '').toLowerCase();
      return (
        row.name.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        row.mobile.toLowerCase().includes(q) ||
        deptNames.includes(q) ||
        spec.includes(q)
      );
    });
  }, [data?.data, departmentLookup, specialtyLookup, search]);

  const openCreate = () => {
    setFormMode('create');
    setEditingId(null);
    setFormError('');
    reset(defaultFormValues);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    const raw = row?.raw || {};
    setFormMode('edit');
    setEditingId(row?.id ?? raw?.id ?? null);
    setFormError('');
    reset({
      doctor_code: raw.doctor_code || '',
      name: raw.name || '',
      doctor_type: raw.doctor_type || 'consultant',
      departments: Array.isArray(raw.departments) ? raw.departments.map(String) : [],
      specialty: raw.specialty != null ? String(raw.specialty) : '',
      mobile_number: raw.mobile_number || '',
      alternate_mobile_number: raw.alternate_mobile_number || '',
      address: raw.address || '',
      consultation_fee: raw.consultation_fee != null ? String(raw.consultation_fee) : '',
      is_active: raw.is_active !== false,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setFormError('');
  };

  const onSubmit = async (values) => {
    setFormError('');
    const payload = toApiPayload(values);
    try {
      if (formMode === 'create') {
        await create.mutateAsync(payload);
        showToast({ type: 'success', message: 'Doctor created' });
      } else if (editingId != null) {
        await patch.mutateAsync({ id: editingId, payload });
        showToast({ type: 'success', message: 'Doctor updated' });
      }
      closeForm();
    } catch (e) {
      setFormError(getApiErrorMessage(e));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      await remove.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      showToast({ type: 'success', message: 'Doctor deleted' });
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
    <div className="row g-3">
      <div className="col-12 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <Typography variant="h5">Doctor profiles</Typography>
        <AppButton variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add doctor
        </AppButton>
      </div>

      <div className="col-12 col-md-6 col-lg-4">
        <AppTextField
          label="Search"
          placeholder="Name, code, department, specialty"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {formError && !formOpen ? (
        <div className="col-12">
          <Alert severity="error" onClose={() => setFormError('')}>
            {formError}
          </Alert>
        </div>
      ) : null}

      {isError ? (
        <div className="col-12">
          <Alert severity="error">
            {getApiErrorMessage(error)}
          </Alert>
        </div>
      ) : null}

      <div className="col-12 position-relative">
        {isLoading ? (
          <div className="d-flex justify-content-center py-5">
            <CircularProgress size={32} />
          </div>
        ) : (
          <CommonTable
            columns={[
              {
                id: 'name',
                header: 'Name',
                renderCell: (row) => row.name,
              },
              {
                id: 'code',
                header: 'Code',
                renderCell: (row) => row.code,
              },
              {
                id: 'departments',
                header: 'Departments',
                renderCell: (row) =>
                  row.departments.length ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {row.departments.map((name) => (
                        <Chip key={name} label={name} size="small" variant="outlined" />
                      ))}
                    </Box>
                  ) : (
                    '—'
                  ),
              },
              {
                id: 'specialty',
                header: 'Specialty',
                renderCell: (row) => row.specialty || '—',
              },
              {
                id: 'mobile',
                header: 'Mobile',
                renderCell: (row) => row.mobile || '—',
              },
              {
                id: 'fee',
                header: 'Consultation fee',
                renderCell: (row) => row.fee || '—',
              },
              {
                id: 'status',
                header: 'Status',
                renderCell: (row) => <StatusBadge status={row.isActive ? 'active' : 'inactive'} />,
              },
            ]}
            data={rows}
            emptyMessage="No doctors found"
            getRowId={(row) => row.id}
            renderActions={(row) => (
              <>
                <IconButton size="small" aria-label="Edit doctor" onClick={() => openEdit(row)}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Delete doctor"
                  onClick={() => {
                    setDeleteError('');
                    setDeleteTarget({ id: row.id, name: row.name });
                  }}
                >
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              </>
            )}
          />
        )}
      </div>

      <CommonDialog
        open={formOpen}
        onClose={saving ? () => {} : closeForm}
        title={formMode === 'create' ? 'Add doctor' : 'Edit doctor'}
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
            label="Doctor code"
            required
            {...register('doctor_code')}
            error={Boolean(errors.doctor_code)}
            helperText={errors.doctor_code?.message}
          />
          <AppTextField
            label="Name"
            required
            {...register('name')}
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
          />
          <AppTextField
            label="Doctor type"
            placeholder="e.g. consultant"
            {...register('doctor_type')}
            error={Boolean(errors.doctor_type)}
            helperText={errors.doctor_type?.message}
          />
          <Controller
            name="departments"
            control={control}
            render={({ field, fieldState }) => (
              <AppSelect
                label="Departments"
                id="departments"
                multiple
                value={field.value}
                onChange={(event) => {
                  const value = event.target.value;
                  field.onChange(typeof value === 'string' ? value.split(',') : value);
                }}
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
          <Controller
            name="specialty"
            control={control}
            render={({ field, fieldState }) => (
              <AppSelect
                label="Specialty"
                id="specialty"
                {...field}
                error={fieldState.error}
              >
                {specialtyOptions.map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </MenuItem>
                ))}
              </AppSelect>
            )}
          />
          <AppTextField
            label="Mobile number"
            required
            {...register('mobile_number')}
            error={Boolean(errors.mobile_number)}
            helperText={errors.mobile_number?.message}
          />
          <AppTextField
            label="Alternate mobile number"
            {...register('alternate_mobile_number')}
            error={Boolean(errors.alternate_mobile_number)}
            helperText={errors.alternate_mobile_number?.message}
          />
          <AppTextField
            label="Address"
            multiline
            minRows={2}
            {...register('address')}
            error={Boolean(errors.address)}
            helperText={errors.address?.message}
          />
          <AppTextField
            label="Consultation fee"
            {...register('consultation_fee')}
            error={Boolean(errors.consultation_fee)}
            helperText={errors.consultation_fee?.message}
          />
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(field.value)}
                      onChange={(_, v) => field.onChange(v)}
                    />
                  }
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
        </div>
      </CommonDialog>

      <CommonDialog
        open={Boolean(deleteTarget)}
        onClose={remove.isPending ? () => {} : closeDeleteDialog}
        title="Delete doctor"
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
          <Alert severity="error" className="mb-2" onClose={() => setDeleteError('')}>
            {deleteError}
          </Alert>
        ) : null}
        <Typography variant="body2">
          Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </Typography>
      </CommonDialog>
    </div>
  );
}
