export const ADMIN_MODULES = {
  users: {
    title: 'Users',
    endpoint: '/admin/users/',
    fields: ['email', 'first_name', 'last_name', 'phone', 'hospital', 'is_active', 'is_staff', 'is_superuser'],
  },
  departments: {
    title: 'Departments',
    endpoint: '/departments/',
    fields: ['hospital', 'code', 'name', 'is_active'],
  },
  designations: {
    title: 'Designations',
    endpoint: '/designations/',
    fields: ['hospital', 'code', 'name', 'is_active'],
  },
  staff: {
    title: 'Staff',
    endpoint: '/staff/',
    fields: ['hospital', 'employee_code', 'first_name', 'last_name', 'phone', 'email', 'designation', 'department', 'is_active'],
  },
  specialties: {
    title: 'Specialties',
    endpoint: '/specialties/',
    fields: ['hospital', 'code', 'name', 'department', 'is_active'],
  },
  doctors: {
    title: 'Doctor Profiles',
    endpoint: '/doctor-profiles/',
    fields: ['hospital', 'user', 'name', 'specialty', 'doctor_type', 'mobile_number', 'consultation_fee', 'is_active'],
  },
  attendanceDaily: {
    title: 'Attendance Daily Records',
    endpoint: '/admin/attendance/daily-records/',
    fields: ['hospital', 'staff', 'attendance_date', 'check_in_at', 'check_out_at', 'status', 'notes'],
  },
  attendanceRegularizations: {
    title: 'Attendance Regularizations',
    endpoint: '/admin/attendance/regularizations/',
    fields: ['hospital', 'staff', 'attendance_date', 'requested_check_in_at', 'requested_check_out_at', 'reason', 'status', 'review_notes'],
  },
  attendanceLeaves: {
    title: 'Leave Applications',
    endpoint: '/admin/attendance/leaves/',
    fields: ['hospital', 'staff', 'leave_type', 'start_date', 'end_date', 'is_half_day', 'first_half', 'reason', 'status', 'rejection_notes'],
  },
  attendanceBalances: {
    title: 'Leave Balances',
    endpoint: '/admin/attendance/leave-balances/',
    fields: ['staff', 'leave_type', 'balance_days'],
  },
  patients: {
    title: 'Patients',
    endpoint: '/patients/',
    fields: ['hospital', 'uhid', 'first_name', 'middle_name', 'last_name', 'gender', 'phone', 'email', 'status'],
  },
  opdVisits: {
    title: 'OPD Visits',
    endpoint: '/opd-visits/',
    fields: ['hospital', 'patient', 'visit_date', 'queue_number', 'doctor_user', 'visit_reason', 'status'],
  },
  ipdAdmissions: {
    title: 'IPD Admissions',
    endpoint: '/ipd-admissions/',
    fields: ['hospital', 'patient', 'admission_date', 'admitting_doctor', 'status', 'bed'],
  },
  units: {
    title: 'Units',
    endpoint: '/units/',
    fields: ['code', 'name', 'is_active'],
  },
  medicineCategories: {
    title: 'Medicine Categories',
    endpoint: '/medicine-categories/',
    fields: ['name', 'is_active', 'rule_type', 'allow_loose_sale', 'base_unit_label', 'retail_pack_label', 'outer_pack_label'],
  },
  medicines: {
    title: 'Medicines',
    endpoint: '/medicines/',
    fields: ['sku', 'name', 'company_name', 'form', 'composition', 'strength', 'unit', 'hsn_code', 'pack_info', 'default_mrp', 'gst_percent', 'is_active'],
  },
  batches: {
    title: 'Batches',
    endpoint: '/batches/',
    fields: ['medicine', 'batch_no', 'expiry_date', 'mfg_date', 'unit_cost', 'mrp', 'sale_rate'],
  },
  pharmacySuppliers: {
    title: 'Pharmacy Suppliers',
    endpoint: '/pharmacy/suppliers/',
    fields: ['name', 'phone', 'gst_number', 'address', 'is_active'],
  },
  pharmacyInvoices: {
    title: 'Pharmacy Invoices',
    endpoint: '/pharmacy/invoices/',
    fields: ['patient', 'referred_by', 'date', 'status', 'gst_enabled', 'subtotal', 'total_discount', 'cgst', 'sgst', 'grand_total', 'payment_method', 'paid_amount', 'remarks'],
  },
  pharmacyItems: {
    title: 'Pharmacy Invoice Items',
    endpoint: '/pharmacy/items/',
    fields: ['invoice', 'medicine', 'batch', 'qty', 'mrp', 'rate', 'cgst_rate', 'sgst_rate', 'amount'],
  },
  labCategories: {
    title: 'Lab Categories',
    endpoint: '/lab/categories/',
    fields: ['hospital', 'name', 'description', 'is_active'],
  },
  labTests: {
    title: 'Lab Tests',
    endpoint: '/lab/tests/',
    fields: ['hospital', 'category', 'name', 'code', 'price', 'tat_hours', 'sample_type', 'is_active'],
  },
  labReports: {
    title: 'Lab Reports',
    endpoint: '/lab/reports/',
    fields: ['hospital', 'patient', 'doctor', 'status', 'remarks'],
  },
  labResults: {
    title: 'Lab Results',
    endpoint: '/lab/results/',
    fields: ['report', 'test', 'result_value', 'result_text', 'status'],
  },
  leaveApprovers: {
    title: 'Leave Approvers',
    endpoint: '/settings/leave-approvers/',
    fields: ['hospital', 'approver_user', 'is_active', 'priority'],
  },
  rbacModules: {
    title: 'RBAC Modules',
    endpoint: '/admin/rbac/modules/',
    fields: ['code', 'name', 'is_active'],
  },
  rbacPermissions: {
    title: 'RBAC Permissions',
    endpoint: '/admin/rbac/permissions/',
    fields: ['module', 'action', 'code', 'description', 'is_active'],
  },
  rbacPermissionGroups: {
    title: 'RBAC Permission Groups',
    endpoint: '/admin/rbac/permission-groups/',
    fields: ['hospital', 'name', 'code', 'is_active'],
  },
  rbacRoles: {
    title: 'RBAC Roles',
    endpoint: '/admin/rbac/roles/',
    fields: ['hospital', 'name', 'code', 'is_system', 'is_active', 'is_deleted'],
  },
}

export const ADMIN_NAV_GROUPS = [
  { title: 'Accounts & RBAC', keys: ['users', 'rbacModules', 'rbacPermissions', 'rbacPermissionGroups', 'rbacRoles'] },
  { title: 'Doctors & Staff', keys: ['departments', 'designations', 'staff', 'specialties', 'doctors'] },
  { title: 'Attendance', keys: ['attendanceDaily', 'attendanceRegularizations', 'attendanceLeaves', 'attendanceBalances', 'leaveApprovers'] },
  { title: 'Patients & Careflow', keys: ['patients', 'opdVisits', 'ipdAdmissions'] },
  { title: 'Inventory & Pharmacy', keys: ['units', 'medicineCategories', 'medicines', 'batches', 'pharmacySuppliers', 'pharmacyInvoices', 'pharmacyItems'] },
  { title: 'Lab', keys: ['labCategories', 'labTests', 'labReports', 'labResults'] },
]
