import { z } from 'zod';

export const specialtyFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  code: z.string().min(1, 'Code is required').max(80),
  department: z.string().min(1, 'Department is required'),
  description: z.string().max(2000).optional(),
  is_active: z.boolean().optional(),
});

