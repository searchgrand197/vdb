import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, TableRow, TableCell, CircularProgress, MenuItem } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { ADMIN_ROUTES } from '@/constants/routes';
import { ROLES } from '@/constants/roles';
import { useAuth } from '@admin/context/AuthContext';
import { userHasRole } from '@/utils/roleUtils';
import { usePatientsQuery } from '@/hooks/usePatientsQuery';
import { AppTable } from '@/components/AppTable';
import { AppButton } from '@/components/AppButton';
import { AppTextField } from '@/components/AppTextField';
import { AppSelect } from '@/components/AppSelect';
import { AppStatusBadge } from '@/components/AppStatusBadge';

const columns = [
  { id: 'mrn', header: 'MRN', renderCell: (row) => row.mrn },
  { id: 'name', header: 'Patient', renderCell: (row) => `${row.firstName || ''} ${row.lastName || ''}`.trim() },
  { id: 'dob', header: 'DOB', renderCell: (row) => row.dateOfBirth },
  { id: 'gender', header: 'Gender', renderCell: (row) => row.gender },
  { id: 'phone', header: 'Phone', renderCell: (row) => row.phone },
  { id: 'status', header: 'Status', renderCell: (row) => <AppStatusBadge status={row.status} /> },
];

const createRoles = [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.STAFF];

export function PatientList() {
  const { user } = useAuth();
  const canCreate = userHasRole(user, createRoles);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const params = useMemo(() => ({ search, status }), [search, status]);
  const { data, isLoading, isError, error } = usePatientsQuery(params);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="h5">Patients</Typography>
        {canCreate ? (
          <AppButton variant="contained" startIcon={<AddIcon />} component={RouterLink} to={ADMIN_ROUTES.PATIENT_NEW}>
            Add patient
          </AppButton>
        ) : null}
      </Box>

      <Box sx={{ maxWidth: { md: '33.33%', lg: '25%' } }}>
        <AppTextField
          label="Search"
          placeholder="Name, MRN, phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Box>
      <Box sx={{ maxWidth: { md: '33.33%', lg: '25%' } }}>
        <AppSelect label="Status" id="filter-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </AppSelect>
      </Box>

      <Box sx={{ position: 'relative' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress size={32} />
          </Box>
        ) : isError ? (
          <Typography color="error">{error?.message || 'Failed to load patients'}</Typography>
        ) : (
          <AppTable
            columns={columns}
            data={data?.data || []}
            emptyMessage="No patients match your filters"
            getRowId={(row) => row.id}
          />
        )}
      </Box>
    </Box>
  );
}
