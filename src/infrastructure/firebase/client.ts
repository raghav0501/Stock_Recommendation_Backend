/**
 * Firebase Admin SDK singleton.
 *
 * Initialises once and exports:
 *   - getFirestore() → Firestore instance (replaces MongoDB)
 *
 * Firestore collections used:
 *   chat_sessions       – chat session metadata
 *   chat_messages       – individual chat messages
 *   logs                – application logs
 *   refresh_tokens      – encrypted refresh tokens (replaces Redis)
 *   password_resets     – time-limited reset tokens (replaces Redis)
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import type { Firestore } from 'firebase-admin/firestore';
import { config } from '../../config';
import { createServiceLogger } from '../logger';

const log = createServiceLogger('firebase');

let _db: Firestore | null = null;

export function initFirebase(): Firestore {
  if (_db) return _db;

  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(
      readFileSync(config.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf-8'),
    ) as admin.ServiceAccount;

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId:  config.FIREBASE_PROJECT_ID,
    });

    log.info('Firebase Admin SDK initialised', {
      meta: { projectId: config.FIREBASE_PROJECT_ID },
    });
  }

  // Pass the database ID explicitly — required when using a non-default database
  _db = admin.firestore();
  _db.settings({
    ignoreUndefinedProperties: true,
    databaseId: config.FIREBASE_DATABASE_ID,
  });

  return _db;
}

export function getFirestore(): Firestore {
  if (!_db) return initFirebase();
  return _db;
}

export const Collections = {
  CHAT_SESSIONS:   'chat_sessions',
  CHAT_MESSAGES:   'chat_messages',
  LOGS:            'logs',
  REFRESH_TOKENS:  'refresh_tokens',
  PASSWORD_RESETS: 'password_resets',
} as const;