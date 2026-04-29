import { useEffect, useMemo, useState } from 'react';
import { Alert, CircularProgress, Typography } from '@mui/material';
import { AppButton } from '@admin/components/AppButton';
import { AppTextField } from '@admin/components/AppTextField';
import { CommonTable } from '@admin/components/common/CommonTable';
import { useDesignationsQuery } from '@/hooks/useDesignationsQuery';
import { useEarnedLeaveAllocations, useEarnedLeaveMutations } from '@/hooks/useEarnedLeaveAllocations';
import { useAuth } from '@admin/context/AuthContext';
import { useToast } from '@admin/context/ToastContext';
import { getApiErrorMessage } from '@/utils/apiError';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function EarnedLeavePlannerPage() {
  const { user } = useAuth();
  const hospitalId = user?.hospital_id
    ? String(user.hospital_id).trim()
    : import.meta.env.VITE_HOSPITAL_ID?.trim() || null;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [draft, setDraft] = useState({});
  const { showToast } = useToast();

  const { data: desigData, isLoading: desigLoading, isError: desigError, error: desigErr } =
    useDesignationsQuery();
  const {
    data: allocData,
    isLoading: allocLoading,
    isError: allocError,
    error: allocErr,
    refetch,
  } = useEarnedLeaveAllocations(year);
  const { save } = useEarnedLeaveMutations();

  const designations = useMemo(() => {
    const list = desigData?.data ?? [];
    return list.map((d) => ({
      id: d?.id ?? d?.pk,
      name: d?.name ?? '—',
      code: d?.code ?? d?.designation_code ?? '',
    }));
  }, [desigData?.data]);

  useEffect(() => {
    const rows = allocData?.data ?? allocData ?? [];
    const next = {};
    for (const d of designations) {
      const row = {};
      for (const m of MONTHS) {
        const match = rows.find(
          (r) => String(r.designation) === String(d.id) && Number(r.month) === m
        );
        row[m] = match?.earned_days != null ? String(match.earned_days) : '';
      }
      next[d.id] = row;
    }
    setDraft(next);
  }, [allocData, designations]);

  const handleCellChange = (designationId, month, value) => {
    setDraft((prev) => ({
      ...prev,
      [designationId]: {
        ...(prev[designationId] || {}),
        [month]: value,
      },
    }));
  };

  const rows = useMemo(
    () =>
      designations.map((d) => ({
        id: d.id,
        designationLabel: d.code ? `${d.name} (${d.code})` : d.name,
      })),
    [designations]
  );

  const loading = desigLoading || allocLoading;

  const onReload = () => {
    refetch();
  };

  const onSave = async () => {
    if (!hospitalId) {
      showToast({
        type: 'error',
        message:
          'No hospital is linked to this session. Log out and log in again so your hospital id is saved.',
      });
      return;
    }
    const payload = [];
    for (const d of designations) {
      const row = draft[d.id] || {};
      for (const m of MONTHS) {
        const rawVal = row[m];
        const parsed = rawVal === '' || rawVal == null ? 0 : Number(rawVal);
        if (Number.isNaN(parsed)) continue;
        payload.push({
          hospital: hospitalId,
          year,
          month: m,
          designation: d.id,
          earned_days: parsed,
        });
      }
    }
    try {
      await save.mutateAsync(payload);
      showToast({ type: 'success', message: 'Yearly earned leave planner saved' });
    } catch (e) {
      showToast({ type: 'error', message: getApiErrorMessage(e) });
    }
  };

  const anyError = desigError || allocError;
  const errorMessage = desigError ? getApiErrorMessage(desigErr) : getApiErrorMessage(allocErr);

  return (
    <div className="row g-3">
      <div className="col-12 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <Typography variant="h5">Yearly earned leave planner — {year}</Typography>
      </div>

      {user?.hospital_name ? (
        <div className="col-12">
          <Typography variant="body2" color="text.secondary">
            Hospital: {user.hospital_name}
          </Typography>
        </div>
      ) : null}

      {!hospitalId ? (
        <div className="col-12">
          <Alert severity="warning">
            Hospital id is missing. Log out and sign in again to load it from the server, or set
            VITE_HOSPITAL_ID in env for development.
          </Alert>
        </div>
      ) : null}

      <div className="col-12 col-md-6 col-lg-4 d-flex align-items-end gap-2">
        <AppTextField
          label="Year"
          type="number"
          value={year}
          onChange={(e) => {
            const val = Number(e.target.value);
            setYear(Number.isNaN(val) ? '' : val);
          }}
        />
        <AppButton variant="outlined" onClick={onReload}>
          Reload
        </AppButton>
      </div>

      {anyError ? (
        <div className="col-12">
          <Alert severity="error">{errorMessage}</Alert>
        </div>
      ) : null}

      <div className="col-12 position-relative">
        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <CircularProgress size={32} />
          </div>
        ) : (
          <CommonTable
            columns={[
              {
                id: 'designation',
                header: 'Designation',
                renderCell: (row) => row.designationLabel,
                width: 260,
              },
              ...MONTHS.map((m) => ({
                id: `m${m}`,
                header: String(m),
                align: 'right',
                width: 72,
                renderCell: (row) => {
                  const value = draft[row.id]?.[m] ?? '';
                  return (
                    <AppTextField
                      fullWidth
                      type="number"
                      size="small"
                      value={value}
                      onChange={(e) => handleCellChange(row.id, m, e.target.value)}
                    />
                  );
                },
              })),
            ]}
            data={rows}
            emptyMessage="No designations found"
            getRowId={(row) => row.id}
          />
        )}
      </div>

      <div className="col-12">
        <AppButton variant="contained" onClick={onSave} disabled={save.isPending || loading}>
          {save.isPending ? 'Saving…' : 'Save yearly planner'}
        </AppButton>
      </div>
    </div>
  );
}

