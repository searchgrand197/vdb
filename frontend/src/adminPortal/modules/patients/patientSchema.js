import { z } from 'zod';

/** Zod schema shared by Add Patient form and future API DTO validation. */
export const patientFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['Male', 'Female', 'Other'], { message: 'Select a valid gender' }),
  phone: z.string().min(8, 'Enter a valid phone'),
  status: z.enum(['active', 'inactive']).default('active'),
});
