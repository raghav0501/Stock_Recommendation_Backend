import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../infrastructure/database/postgres/client';
import { createServiceLogger } from '../../infrastructure/logger';

const log = createServiceLogger('watchlist');

export async function getWatchlist(userId: string, ctx: { sessionId: string; requestId: string }) {
  const items = await prisma.watchlist.findMany({
    where:   { userId },
    orderBy: { addedAt: 'desc' },
    select:  { symbol: true, addedAt: true },
  });
  log.info('Watchlist retrieved', { sessionId: ctx.sessionId, requestId: ctx.requestId, userId });
  return { watchlist: items };
}

export async function addSymbol(userId: string, symbol: string, ctx: { sessionId: string; requestId: string }) {
  const existing = await prisma.watchlist.findUnique({ where: { userId_symbol: { userId, symbol } } });
  if (existing) {
    throw Object.assign(
      new Error(`${symbol} is already in your watchlist`),
      { statusCode: StatusCodes.CONFLICT, code: 'DUPLICATE_SYMBOL' },
    );
  }

  const item = await prisma.watchlist.create({ data: { userId, symbol }, select: { symbol: true, addedAt: true } });
  log.info('Symbol added to watchlist', { sessionId: ctx.sessionId, requestId: ctx.requestId, userId, meta: { symbol } });
  return item;
}

export async function removeSymbol(userId: string, symbol: string, ctx: { sessionId: string; requestId: string }) {
  const existing = await prisma.watchlist.findUnique({ where: { userId_symbol: { userId, symbol } } });
  if (!existing) {
    throw Object.assign(
      new Error(`${symbol} is not in your watchlist`),
      { statusCode: StatusCodes.NOT_FOUND, code: 'SYMBOL_NOT_FOUND' },
    );
  }

  await prisma.watchlist.delete({ where: { userId_symbol: { userId, symbol } } });
  log.info('Symbol removed from watchlist', { sessionId: ctx.sessionId, requestId: ctx.requestId, userId, meta: { symbol } });
}
