import { z } from 'zod';

export const screenerRequestSchema = z.object({
  market: z.string().min(1, 'Market is required'),
  indicators: z
    .array(z.string().min(1))
    .min(1, 'At least 1 indicator required')
    .max(4, 'At most 4 indicators allowed')
    .transform((arr) => [...arr].map((i) => i.toUpperCase()).sort()),
});

// Schema for validating the pipeline response
export const screenerPipelineResponseSchema = z.object({
  bullish: z.array(z.record(z.unknown())),
  bearish: z.array(z.record(z.unknown())),
  neutral: z.array(z.record(z.unknown())).optional().default([]),
});
