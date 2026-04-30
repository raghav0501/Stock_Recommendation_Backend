import { PrismaClient, Prisma } from '@prisma/client';
import { createServiceLogger } from '../../logger';

const log = createServiceLogger('postgres');

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: [
      { emit: 'stdout', level: 'query' },
      { emit: 'event',  level: 'error' },
      { emit: 'event',  level: 'warn' },
    ],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

type LoggingPrisma = PrismaClient<Prisma.PrismaClientOptions, 'error' | 'warn'>;

(prisma as LoggingPrisma).$on('error', (e: Prisma.LogEvent) => {
  log.error('Prisma error', { meta: { message: e.message, target: e.target } });
});

(prisma as LoggingPrisma).$on('warn', (e: Prisma.LogEvent) => {
  log.warn('Prisma warning', { meta: { message: e.message, target: e.target } });
});

export async function connectPostgres(): Promise<void> {
  await prisma.$connect();
  log.info('PostgreSQL connected');
}

export async function disconnectPostgres(): Promise<void> {
  await prisma.$disconnect();
  log.info('PostgreSQL disconnected');
}