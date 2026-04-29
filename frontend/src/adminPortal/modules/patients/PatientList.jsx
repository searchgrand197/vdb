import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Typography, TableRow, TableCell, CircularProgress, MenuItem } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { ADMIN_ROUTES } from '@/constants/routes';
import { ROLES } from '@/constants/roles';
import { useAuth } from '@admin/context/AuthContext';
import { userHasRole } from '@/utils/roleUtils';
import { usePatientsQuery } from '@/hooks/usePatientsQuery';
import { AppTable } from '@admin/components/AppTable';
import { AppButton } from '@admin/components/AppButton';
import { AppTextField } from '@admin/components/AppTextField';
import { AppSelect } from '@admin/components/AppSelect';
import { StatusBadge } from '@admin/components/StatusBadge';

const columns = [
  { id: 'mrn', label: 'MRN' },
  { id: 'name', label: 'Patient' },
  { id: 'dob', label: 'DOB' },
  { id: 'gender', label: 'Gender' },
  { id: 'phone', label: 'Phone' },
  { id: 'status', label: 'Status' },
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
    <div className="row g-3">
      <div className="col-12 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <Typography variant="h5">Patients</Typography>
        {canCreate ? (
          <AppButton variant="contained" startIcon={<AddIcon />} component={RouterLink} to={ADMIN_ROUTES.PATIENT_NEW}>
            Add patient
          </AppButton>
        ) : null}
      </div>

      <div className="col-12 col-md-4 col-lg-3">
        <AppTextField
          label="Search"
          placeholder="Name, MRN, phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="col-12 col-md-4 col-lg-3">
        <AppSelect label="Status" id="filter-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </AppSelect>
      </div>

      <div className="col-12 position-relative">
        {isLoading ? (
          <div className="d-flex justify-content-center py-5">
            <CircularProgress size={32} />
          </div>
        ) : isError ? (
          <Typography color="error">{error?.message || 'Failed to load patients'}</Typography>
        ) : (
          <AppTable columns={columns} emptyMessage="No patients match your filters">
            {data?.data?.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{row.mrn}</TableCell>
                <TableCell>
                  {row.firstName} {row.lastName}
                </TableCell>
                <TableCell>{row.dateOfBirth}</TableCell>
                <TableCell>{row.gender}</TableCell>
                <TableCell>{row.phone}</TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
              </TableRow>
            ))}
          </AppTable>
        )}
      </div>
    </div>
  );
}
