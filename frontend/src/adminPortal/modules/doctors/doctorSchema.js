import { z } from 'zod';

export const doctorFormSchema = z.object({
  doctor_code: z.string().min(1, 'Doctor code is required').max(80),
  name: z.string().min(1, 'Name is required').max(200),
  doctor_type: z.string().min(1, 'Doctor type is required'),
  departments: z.array(z.string().min(1)).min(1, 'At least one department is required'),
  specialty: z.string().min(1, 'Specialty is required'),
  mobile_number: z.string().min(1, 'Mobile number is required').max(20),
  alternate_mobile_number: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  consultation_fee: z.string().optional(),
  is_active: z.boolean().optional(),
});

