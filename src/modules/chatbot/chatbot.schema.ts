import { z } from 'zod';

// Python expects: { message, session_id }
export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(5000),
  // session_id is optional from the frontend but always overridden to userId in the service
  session_id: z.string().optional(),
});

export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});