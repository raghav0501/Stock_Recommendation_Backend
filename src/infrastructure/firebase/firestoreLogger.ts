/**
 * FirestoreLogService
 *
 * Writes structured log entries to the Firestore `logs` collection.
 * Called from the Winston logger pipeline (non-blocking fire-and-forget).
 *
 * Each document has a TTL field `expireAt` which Cloud Firestore TTL
 * policies can use to auto-delete old logs.
 * Set up TTL in GCP Console: Firestore → Indexes → TTL → field: expireAt
 */
import { getFirestore, Collections } from './client';
import { createServiceLogger } from '../logger';
import { Timestamp } from 'firebase-admin/firestore';

const log = createServiceLogger('firestore-logger');

export interface FirestoreLogEntry {
  timestamp:  string;
  level:      string;
  service:    string;
  sessionId?: string;
  requestId?: string;
  userId?:    string;
  message:    string;
  meta?:      Record<string, unknown>;
}

/**
 * Write a log entry to Firestore asynchronously.
 * Never throws — if Firestore is unavailable the entry is silently dropped
 * (the file transport still captures it).
 */
export function writeLogToFirestore(entry: FirestoreLogEntry, retentionDays = 90): void {
  const expireAt = new Date();
  expireAt.setDate(expireAt.getDate() + retentionDays);

  getFirestore()
    .collection(Collections.LOGS)
    .add({ ...entry, expireAt: Timestamp.fromDate(expireAt) })
    .catch((err: unknown) => {
      // Use process.stderr directly — logger would cause infinite recursion
      process.stderr.write(`[firestore-logger] Failed to write log: ${String(err)}\n`);
    });
}

/**
 * Query logs from Firestore with filters.
 * Used by the developer log viewer endpoint.
 */
export interface LogQueryParams {
  sessionId?: string;
  requestId?: string;
  userId?: string;
  level?: string;
  service?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export async function queryFirestoreLogs(params: LogQueryParams) {
  const db   = getFirestore();
  let query: FirebaseFirestore.Query = db.collection(Collections.LOGS);

  if (params.sessionId) query = query.where('sessionId', '==', params.sessionId);
  if (params.requestId) query = query.where('requestId', '==', params.requestId);
  if (params.userId)    query = query.where('userId',    '==', params.userId);
  if (params.level)     query = query.where('level',     '==', params.level);
  if (params.service)   query = query.where('service',   '==', params.service);
  if (params.from)      query = query.where('timestamp', '>=', params.from);
  if (params.to)        query = query.where('timestamp', '<=', params.to);

  // Order and paginate
  query = query.orderBy('timestamp', 'desc');

  // Firestore doesn't support SQL-style OFFSET pagination efficiently.
  // For the small user base we use limit+startAfter cursor pagination.
  // For simplicity in V1 we just limit to page*limit and slice.
  const snapshot = await query.limit(params.page * params.limit).get();
  const allDocs  = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  const start   = (params.page - 1) * params.limit;
  const pageDocs = allDocs.slice(start, start + params.limit);

  log.info('Firestore logs queried', { meta: { params, total: allDocs.length } });

  return {
    logs:       pageDocs,
    pagination: {
      page:       params.page,
      limit:      params.limit,
      total:      allDocs.length,
      totalPages: Math.ceil(allDocs.length / params.limit),
    },
  };
}