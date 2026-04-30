import { z } from 'zod';

export const chatMessageSchema = z.object({
  query:     z.string().min(1, 'Query cannot be empty').max(2000),
  sessionId: z.string().optional(), // MongoDB ObjectId string — omit to create a new session
  context: z
    .object({
      market:               z.string().optional(),
      selectedIndicators:   z.array(z.string()).optional(),
      recentlyViewedStocks: z.array(z.string()).optional(),
    })
    .optional(),
});

export const getSessionsSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const getMessagesSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Validates the shape of a chatbot pipeline response
export const chatbotPipelineResponseSchema = z.object({
  text:          z.string(),
  plots:         z.array(z.unknown()).optional().default([]),
  newsSnippets:  z.array(z.unknown()).optional().default([]),
  signalSummary: z.record(z.unknown()).optional(),
});
