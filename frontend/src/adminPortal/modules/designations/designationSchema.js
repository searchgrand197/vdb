import { z } from 'zod';

export const designationFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  code: z.string().min(1, 'Code is required').max(80),
  description: z.string().max(2000).optional(),
});

