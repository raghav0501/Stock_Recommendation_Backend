/**
 * Health check routes.
 *
 * GET /health        – liveness (no auth)
 * GET /health/ready  – readiness: checks PostgreSQL + Firestore
 */
import { Router, Request, Response } from 'express';
import { config } from '../../config';
import { prisma } from '../../infrastructure/database/postgres/client';
import { getFirestore } from '../../infrastructure/firebase/client';

const router = Router();

router.get('/', (_req: Request, res: Response): void => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    env:       config.NODE_ENV,
    version:   process.env.npm_package_version ?? '1.0.0',
  });
});

router.get('/ready', async (_req: Request, res: Response): Promise<void> => {
  const checks: Record<string, 'ok' | 'error'> = {};
  let allOk = true;

  // PostgreSQL (Cloud SQL)
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks['cloud_sql'] = 'ok';
  } catch {
    checks['cloud_sql'] = 'error';
    allOk = false;
  }

  // Firestore
  try {
    await getFirestore().collection('_health').doc('ping').set({ ts: new Date().toISOString() });
    checks['firestore'] = 'ok';
  } catch {
    checks['firestore'] = 'error';
    allOk = false;
  }

  res.status(allOk ? 200 : 503).json({
    status:    allOk ? 'ready' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;