import app from './app';
import { config } from './config';
import { connectPostgres, disconnectPostgres } from './infrastructure/database/postgres/client';
import { initFirebase } from './infrastructure/firebase/client';
import { logger } from './infrastructure/logger';
import admin from 'firebase-admin';

async function bootstrap(): Promise<void> {
  try {
    // ── Initialise Firebase Admin (Firestore) ────────────────────────────
    initFirebase();

    // ── Connect to Cloud SQL (PostgreSQL) ────────────────────────────────
    await connectPostgres();

    // ── Start HTTP server ────────────────────────────────────────────────
    const server = app.listen(config.PORT, () => {
      logger.info(`Server listening on port ${config.PORT}`, {
        service: 'server',
        meta:    { port: config.PORT, env: config.NODE_ENV },
      });
    });

    // ── Graceful shutdown ────────────────────────────────────────────────
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received – shutting down gracefully`, { service: 'server' });

      server.close(async () => {
        try {
          await disconnectPostgres();
          if (admin.apps.length) {
            await admin.app().delete();
            logger.info('Firebase disconnected', { service: 'server' });
          }
          logger.info('All connections closed. Goodbye.', { service: 'server' });
          process.exit(0);
        } catch (err) {
          logger.error('Error during shutdown', { service: 'server', meta: { err: String(err) } });
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout', { service: 'server' });
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT',  () => void shutdown('SIGINT'));

  } catch (err) {
    logger.error('Failed to start server', { service: 'server', meta: { err: String(err) } });
    process.exit(1);
  }
}

void bootstrap();