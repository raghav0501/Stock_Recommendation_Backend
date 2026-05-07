import { z } from 'zod';

// Frontend sends: 
// {
//   "exchange": "india",
//   "filters": {
//     "rsi_14": {},
//     "sma_50": {}
//   }
// }
// We also accept the simpler array form from internal use: { exchange, indicators: ["SMA_20"] }
export const screenerRequestSchema = z.object({
  exchange: z.string().min(1, 'exchange is required'),
  // filters is an object whose keys are signal names — matches Python exactly
  filters: z.record(z.unknown()).optional(),
  // convenience array form — converted to filters object in service
  indicators: z.array(z.string()).optional(),
});

export type ScreenerRequest = z.infer<typeof screenerRequestSchema>;