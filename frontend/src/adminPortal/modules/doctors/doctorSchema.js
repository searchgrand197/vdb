import { z } from 'zod';

/** Must match `DoctorProfile.DoctorType` on the backend. */
export const DOCTOR_TYPE_OPTIONS = [
  { value: 'consultant', label: 'Consultant' },
  { value: 'visiting', label: 'Visiting' },
  { value: 'resident', label: 'Resident' },
  { value: 'other', label: 'Other' },
];

export const DOCTOR_TYPE_VALUES = new Set(DOCTOR_TYPE_OPTIONS.map((o) => o.value));

export const doctorFormSchema = z.object({
  doctor_code: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Doctor code is required').max(80)),
  name: z.string().min(1, 'Name is required').max(200),
  doctor_type: z.string().refine((v) => DOCTOR_TYPE_VALUES.has(v), { message: 'Select a valid doctor type' }),
  departments: z.array(z.string().min(1)).min(1, 'At least one department is required'),
  specialty: z.string().min(1, 'Specialty is required'),
  mobile_number: z.string().min(1, 'Mobile number is required').max(20),
  alternate_mobile_number: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  consultation_fee: z.string().optional(),
  is_active: z.boolean().optional(),
});

