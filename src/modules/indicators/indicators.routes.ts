import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/postgres/client';
import { createServiceLogger } from '../../infrastructure/logger';
import { sendSuccess } from '../../utils/response';
import { authenticate, loadEntitlements, requireRole } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';

const log = createServiceLogger('indicators');

// ── Service ────────────────────────────────────────────────────────────────
async function getEntitledIndicators(userId: string, ctx: { sessionId?: string; requestId?: string }) {
  const rows = await prisma.roleIndicator.findMany({
    where: { role: { users: { some: { id: userId } } } },
    include: { indicator: true },
  });
  const indicators = rows
    .filter((r) => r.indicator.isActive)
    .map((r) => ({
      id: r.indicator.id,
      name: r.indicator.name,
      description: r.indicator.description,
      category: r.indicator.category,
      scale: r.indicator.scale,
    }));
  log.info('Entitled indicators listed', { sessionId: ctx.sessionId, requestId: ctx.requestId, userId });
  return { indicators };
}

async function getAllIndicators(ctx: { sessionId?: string; requestId?: string }) {
  const indicators = await prisma.indicator.findMany({ where: { isActive: true } });
  log.info('All indicators listed (developer)', { sessionId: ctx.sessionId, requestId: ctx.requestId });
  return { indicators };
}

// ── Controller ─────────────────────────────────────────────────────────────
async function listEntitled(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const result  = await getEntitledIndicators(authReq.user.id, authReq.ctx);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getAllIndicators((req as AuthenticatedRequest).ctx);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

// ── Routes ─────────────────────────────────────────────────────────────────
const router = Router();
router.get('/',    authenticate, loadEntitlements, listEntitled);
router.get('/all', authenticate, requireRole('developer'), listAll);

export default router;
