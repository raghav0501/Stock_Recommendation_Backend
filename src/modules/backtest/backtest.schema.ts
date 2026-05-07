import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const signalCountRequestSchema = z.object({
  exchange:  z.string().min(1, 'exchange is required'),
  symbol:    z.string().min(1, 'symbol is required'),
  indicator: z.string().min(1, 'indicator is required'),
  date_from: dateString,
  date_to:   dateString,
});

export type SignalCountRequest = z.infer<typeof signalCountRequestSchema>;
