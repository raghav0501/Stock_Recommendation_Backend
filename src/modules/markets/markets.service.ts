// ── Service ────────────────────────────────────────────────────────────────
import { prisma } from '../../infrastructure/database/postgres/client';
import { createServiceLogger } from '../../infrastructure/logger';

const log = createServiceLogger('markets');

export async function getActiveMarkets(ctx: { sessionId?: string; requestId?: string }) {
  const markets = await prisma.market.findMany({ where: { isActive: true } });
  log.info('Markets listed', { sessionId: ctx.sessionId, requestId: ctx.requestId });
  return { markets };
}
