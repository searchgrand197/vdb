import { Navigate, Route, Routes } from 'react-router-dom';
import { ADMIN_ROUTES } from '@/constants/routes';
import { ROLES, ALL_ROLES } from '@/constants/roles';
import { HMS_API_RESOURCES } from '@/constants/hmsApiNav';
import { DashboardLayout } from '@admin/layouts/DashboardLayout';
import { DashboardPage } from '@admin/modules/dashboard/DashboardPage';
import { PatientList } from '@admin/modules/patients/PatientList';
import { AddPatient } from '@admin/modules/patients/AddPatient';
import { DoctorsPage } from '@admin/modules/doctors/DoctorsPage';
import { AppointmentsPage } from '@admin/modules/appointments/AppointmentsPage';
import { DepartmentsPage } from '@admin/modules/departments/DepartmentsPage';
import { DesignationsPage } from '@admin/modules/designations/DesignationsPage';
import { DesignationPermissionsPage } from '@admin/modules/permissions/DesignationPermissionsPage';
import { SpecialtiesPage } from '@admin/modules/specialties/SpecialtiesPage';
import { StaffPage } from '@admin/modules/staff/StaffPage';
import { EarnedLeavePlannerPage } from '@admin/modules/attendance/EarnedLeavePlannerPage';
import { BedsPage } from '@admin/modules/beds/BedsPage';
import { SchemesPage } from '@admin/modules/schemes/SchemesPage';
import { CashCollectionPage } from '@admin/modules/collections/CashCollectionPage';
import { DailyReportPage } from '@admin/modules/reports/DailyReportPage';
import { ApiModulePage } from '@admin/modules/common/ApiModulePage';
import { ProtectedRoute } from '@admin/routes/ProtectedRoute';
import { RoleRoute } from '@admin/routes/RoleRoute';

const doctorModuleRoles = [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR];
const patientCreateRoles = [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.STAFF];

/**
 * Admin portal routes — rendered under /admin/* in the main App.
 * All paths here are relative (no /admin prefix); the parent Route adds it.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />

          <Route path="patients" element={<PatientList />} />
          <Route
            path="patients/new"
            element={
              <RoleRoute allowedRoles={patientCreateRoles}>
                <AddPatient />
              </RoleRoute>
            }
          />

          <Route
            path="doctor-profiles"
            element={
              <RoleRoute allowedRoles={doctorModuleRoles}>
                <DoctorsPage />
              </RoleRoute>
            }
          />

          <Route
            path="appointments"
            element={
              <RoleRoute allowedRoles={ALL_ROLES}>
                <AppointmentsPage />
              </RoleRoute>
            }
          />

          <Route
            path="departments"
            element={
              <RoleRoute allowedRoles={ALL_ROLES}>
                <DepartmentsPage />
              </RoleRoute>
            }
          />

          <Route
            path="designations"
            element={
              <RoleRoute allowedRoles={ALL_ROLES}>
                <DesignationsPage />
              </RoleRoute>
            }
          />

          <Route
            path="permissions"
            element={
              <RoleRoute allowedRoles={ALL_ROLES}>
                <DesignationPermissionsPage />
              </RoleRoute>
            }
          />

          <Route
            path="specialties"
            element={
              <RoleRoute allowedRoles={ALL_ROLES}>
                <SpecialtiesPage />
              </RoleRoute>
            }
          />

          <Route
            path="staff"
            element={
              <RoleRoute allowedRoles={ALL_ROLES}>
                <StaffPage />
              </RoleRoute>
            }
          />

          <Route
            path="attendance-earned-leave-allocations"
            element={
              <RoleRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN]}>
                <EarnedLeavePlannerPage />
              </RoleRoute>
            }
          />

          <Route
            path="beds"
            element={
              <RoleRoute allowedRoles={ALL_ROLES}>
                <BedsPage />
              </RoleRoute>
            }
          />

          <Route
            path="schemes"
            element={
              <RoleRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN]}>
                <SchemesPage />
              </RoleRoute>
            }
          />

          <Route
            path="cash-collection"
            element={
              <RoleRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN]}>
                <CashCollectionPage />
              </RoleRoute>
            }
          />

          <Route
            path="daily-report"
            element={
              <RoleRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN]}>
                <DailyReportPage />
              </RoleRoute>
            }
          />

          {HMS_API_RESOURCES.filter((r) => !r.customElement).map((r) => (
            <Route
              key={r.segment}
              path={r.segment}
              element={
                <RoleRoute allowedRoles={r.roles}>
                  <ApiModulePage title={r.title} apiListPath={r.apiListPath} />
                </RoleRoute>
              }
            />
          ))}

          <Route path="doctors" element={<Navigate to="doctor-profiles" replace />} />
          <Route path="billing" element={<Navigate to="invoices" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={ADMIN_ROUTES.DASHBOARD} replace />} />
    </Routes>
  );
}
