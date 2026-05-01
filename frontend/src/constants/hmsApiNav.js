/**
 * Sidebar + router resources aligned with HMS API (api/v1/*).
 * `customElement`: real page component registered in AppRoutes (not ApiModulePage).
 * Paths are relative to /admin prefix.
 */
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import BusinessOutlined from '@mui/icons-material/BusinessOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import LocalHospitalOutlined from '@mui/icons-material/LocalHospitalOutlined';
import ContactPhoneOutlined from '@mui/icons-material/ContactPhoneOutlined';
import PhoneForwardedOutlined from '@mui/icons-material/PhoneForwardedOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import HotelOutlined from '@mui/icons-material/HotelOutlined';
import MedicalServicesOutlined from '@mui/icons-material/MedicalServicesOutlined';
import PeopleOutline from '@mui/icons-material/PeopleOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import CategoryOutlined from '@mui/icons-material/CategoryOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import ConfirmationNumberOutlined from '@mui/icons-material/ConfirmationNumberOutlined';
import SecurityOutlined from '@mui/icons-material/SecurityOutlined';

import { ALL_ROLES, ROLES } from '@/constants/roles';

/** Default: all roles; tighten per row with `roles` when product rules are defined. */
const ALL = ALL_ROLES;

export const HMS_API_RESOURCES = [
  {
    segment: 'permissions',
    title: 'My permissions',
    apiListPath: '/api/v1/me/permissions/',
    Icon: SecurityOutlined,
    roles: ALL,
  },
  {
    segment: 'appointments',
    title: 'Appointments',
    apiListPath: '/api/v1/appointments/',
    Icon: EventNoteOutlined,
    roles: ALL,
    customElement: true,
  },
  {
    segment: 'daily-availability',
    title: 'Daily availability',
    apiListPath: '/api/v1/daily-availability/',
    Icon: CalendarMonthOutlined,
    roles: ALL,
  },
  {
    segment: 'departments',
    title: 'Departments',
    apiListPath: '/api/v1/departments/',
    Icon: BusinessOutlined,
    roles: ALL,
    customElement: true,
  },
  {
    segment: 'designations',
    title: 'Designations',
    apiListPath: '/api/v1/designations/',
    Icon: BadgeOutlined,
    roles: ALL,
    customElement: true,
  },
  {
    segment: 'doctor-profiles',
    title: 'Doctor profiles',
    apiListPath: '/api/v1/doctor-profiles/',
    Icon: LocalHospitalOutlined,
    roles: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR],
    customElement: true,
  },
  {
    segment: 'emergency-contacts',
    title: 'Emergency contacts',
    apiListPath: '/api/v1/emergency-contacts/',
    Icon: ContactPhoneOutlined,
    roles: ALL,
  },
  {
    segment: 'follow-ups',
    title: 'Follow-ups',
    apiListPath: '/api/v1/follow-ups/',
    Icon: PhoneForwardedOutlined,
    roles: ALL,
  },
  {
    segment: 'invoices',
    title: 'Invoices',
    apiListPath: '/api/v1/invoices/',
    Icon: ReceiptLongOutlined,
    roles: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN],
  },
  {
    segment: 'ipd-admissions',
    title: 'IPD admissions',
    apiListPath: '/api/v1/ipd-admissions/',
    Icon: HotelOutlined,
    roles: ALL,
  },
  {
    segment: 'opd-visits',
    title: 'OPD visits',
    apiListPath: '/api/v1/opd-visits/',
    Icon: MedicalServicesOutlined,
    roles: ALL,
  },
  {
    segment: 'patients',
    title: 'Patients',
    apiListPath: '/api/v1/patients/',
    Icon: PeopleOutline,
    roles: ALL,
    customElement: true,
  },
  {
    segment: 'payments',
    title: 'Payments',
    apiListPath: '/api/v1/payments/',
    Icon: PaymentsOutlined,
    roles: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN],
  },
  {
    segment: 'shifts',
    title: 'Shifts',
    apiListPath: '/api/v1/shifts/',
    Icon: ScheduleOutlined,
    roles: ALL,
  },
  {
    segment: 'attendance-earned-leave-allocations',
    title: 'Earned leave planner',
    apiListPath: '/api/v1/attendance/earned-leave-allocations/',
    Icon: ScheduleOutlined,
    roles: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN],
    customElement: true,
  },
  {
    segment: 'specialties',
    title: 'Specialties',
    apiListPath: '/api/v1/specialties/',
    Icon: CategoryOutlined,
    roles: ALL,
    customElement: true,
  },
  {
    segment: 'staff',
    title: 'Staff',
    apiListPath: '/api/v1/staff/',
    Icon: GroupsOutlined,
    roles: ALL,
    customElement: true,
  },
  {
    segment: 'tokens',
    title: 'Tokens (queue)',
    apiListPath: '/api/v1/tokens/',
    Icon: ConfirmationNumberOutlined,
    roles: ALL,
  },
];
