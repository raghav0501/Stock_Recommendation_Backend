import { z } from 'zod';

export const updatePreferencesSchema = z.object({
  preferredIndicators: z
    .array(z.string().min(1))
    .min(1, 'At least 1 indicator required')
    .max(4, 'At most 4 indicators allowed')
    .transform((arr) => [...arr].map((i) => i.toUpperCase()).sort()),
  theme: z.enum(['light', 'dark']).optional(),
});
