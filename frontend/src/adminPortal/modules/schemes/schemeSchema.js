import { z } from 'zod';

export const schemeFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
  is_active: z.boolean().optional(),
});
