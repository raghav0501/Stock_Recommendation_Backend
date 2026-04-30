import { z } from 'zod';

export const addSymbolSchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(20)
    .transform((s) => s.toUpperCase().trim()),
});

export const symbolParamSchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(20)
    .transform((s) => s.toUpperCase().trim()),
});
