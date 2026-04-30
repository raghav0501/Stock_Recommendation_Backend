import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../infrastructure/database/postgres/client';
import { createServiceLogger } from '../../infrastructure/logger';

const log = createServiceLogger('preferences');

export async function getPreferences(userId: string, ctx: { sessionId: string; requestId: string }) {
  const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
  log.info('Preferences retrieved', { sessionId: ctx.sessionId, requestId: ctx.requestId, userId });
  return prefs ?? { preferredIndicators: [], theme: 'light' };
}

export async function updatePreferences(
  userId: string,
  preferredIndicators: string[],
  theme: 'light' | 'dark' | undefined,
  entitledIndicatorIds: string[],
  ctx: { sessionId: string; requestId: string },
) {
  const entitled   = new Set(entitledIndicatorIds);
  const disallowed = preferredIndicators.filter((id) => !entitled.has(id));

  if (disallowed.length > 0) {
    throw Object.assign(
      new Error(`You are not entitled to: ${disallowed.join(', ')}`),
      { statusCode: StatusCodes.FORBIDDEN, code: 'INDICATOR_NOT_ENTITLED' },
    );
  }

  const prefs = await prisma.userPreferences.upsert({
    where:  { userId },
    create: { userId, preferredIndicators, ...(theme ? { theme } : {}) },
    update: { preferredIndicators, ...(theme ? { theme } : {}) },
  });

  log.info('Preferences updated', { sessionId: ctx.sessionId, requestId: ctx.requestId, userId });
  return prefs;
}
