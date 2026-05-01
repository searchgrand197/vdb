/** Application roles — align with backend when API is wired. */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  HOSPITAL_ADMIN: 'hospital_admin',
  DOCTOR: 'doctor',
  STAFF: 'staff',
};

/** Use for routes that any authenticated role may open (superuser still bypasses via `userHasRole`). */
export const ALL_ROLES = Object.values(ROLES);

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.HOSPITAL_ADMIN]: 'Hospital Admin',
  [ROLES.DOCTOR]: 'Doctor',
  [ROLES.STAFF]: 'Staff',
};
