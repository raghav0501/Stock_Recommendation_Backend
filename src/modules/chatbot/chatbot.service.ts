/**
 * Chatbot Service
 *
 * Design: ONE fixed session per user.
 *   - chat_sessions doc id  = userId   (not a random UUID)
 *   - chat_messages doc id  = uuidv4() (many per user, all have userId + createdAt)
 *
 * Firestore structure:
 *   chat_sessions/{userId}          → session metadata
 *   chat_messages/{uuid}            → individual message pairs (user + assistant)
 *
 * Queries used:
 *   - getSession  → db.collection('chat_sessions').doc(userId).get()   ← NO index needed
 *   - getMessages → .where('userId','==',userId).orderBy('createdAt','asc')
 *                   Requires composite index: userId ASC + createdAt ASC
 *                   (one-time setup — link in README)
 *
 * Index error fix:
 *   The old code ran .where('userId','==').orderBy('updatedAt') on chat_sessions,
 *   which requires a composite index. Now we use .doc(userId).get() — no index at all.
 *   For chat_messages we still need a composite index. See README for the Console link.
 */
import { v4 as uuidv4 } from 'uuid';
import { callPython, PythonCallContext } from '../../utils/pythonClient';
import { getFirestore, Collections } from '../../infrastructure/firebase/client';
import { createServiceLogger } from '../../infrastructure/logger';

const log = createServiceLogger('chatbot');

export interface ChatResponse {
  query:             string;
  classification:    { action: string; response?: string };
  plan:              unknown;
  agent_big_results: unknown;
  agent_results:     unknown[] | null;
  final_response:    string;
  plots:             unknown[];
  news:              unknown[];
  memory: {
    used:                 boolean;
    conversation_history: Array<{ user: string; assistant: string }>;
    recent_context:       string | null;
    history_length:       number;
  };
}

// ── Send message ──────────────────────────────────────────────────────────

export async function sendMessage(
  message:   string,
  userId:    string,      // used as the Firestore session doc ID
  ctx:       PythonCallContext,
): Promise<ChatResponse> {
  log.info('Chat message received', {
    sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
    meta: { messageLength: message.length },
  });

  // Forward userId as the Python session_id so conversation memory is per-user
  const result = await callPython<ChatResponse>(
    'POST',
    '/api/chat/respond',
    ctx,
    { message, session_id: userId },
  );

  log.info('Chat response received', {
    sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
    meta: {
      action:   result.classification?.action,
      hasPlots: (result.plots?.length ?? 0) > 0,
      hasNews:  (result.news?.length ?? 0) > 0,
    },
  });

  // Persist to Firestore — non-blocking so the user gets the response immediately
  _persistToFirestore(userId, message, result, ctx).catch((err) => {
    log.warn('Failed to persist chat message to Firestore', {
      sessionId: ctx.sessionId, requestId: ctx.requestId,
      meta: { err: String(err) },
    });
  });

  return result;
}

async function _persistToFirestore(
  userId:   string,
  message:  string,
  response: ChatResponse,
  ctx:      PythonCallContext,
): Promise<void> {
  const db  = getFirestore();
  const now = new Date().toISOString();

  // ── Upsert the single session doc (doc id = userId) ──────────────────
  // Using merge:true so the first message creates the doc and subsequent
  // messages just update updatedAt and messageCount.
  const sessionRef = db.collection(Collections.CHAT_SESSIONS).doc(userId);
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) {
    // First message for this user — create the session
    await sessionRef.set({
      userId,
      createdAt:    now,
      updatedAt:    now,
      messageCount: 1,
      lastMessage:  message.slice(0, 120),
      isActive:     true,
    });
  } else {
    // Subsequent messages — increment count and refresh preview
    const existing = sessionSnap.data() as { messageCount?: number };
    await sessionRef.update({
      updatedAt:    now,
      messageCount: (existing.messageCount ?? 0) + 1,
      lastMessage:  message.slice(0, 120),
    });
  }

  // ── Write individual message document ────────────────────────────────
  // doc id is random so we can write many messages cheaply
  const msgId = uuidv4();
  await db.collection(Collections.CHAT_MESSAGES).doc(msgId).set({
    id:            msgId,
    userId,                              // ← used in index: userId + createdAt
    sessionId:     userId,               // sessionId = userId (one session per user)
    userMessage:   message,
    finalResponse: response.final_response ?? '',
    action:        response.classification?.action ?? '',
    hasPlots:      (response.plots?.length ?? 0) > 0,
    hasNews:       (response.news?.length ?? 0) > 0,
    createdAt:     now,                  // ← used in index for ordering
  });

  log.info('Chat persisted to Firestore', {
    sessionId: ctx.sessionId, requestId: ctx.requestId, userId,
    meta: { msgId },
  });
}

// ── Get session (single session per user) ─────────────────────────────────
// No query — direct doc lookup by userId. No composite index required.

export async function getSession(userId: string) {
  const db   = getFirestore();
  const snap = await db.collection(Collections.CHAT_SESSIONS).doc(userId).get();

  if (!snap.exists) {
    return { session: null };
  }

  return {
    session: { id: snap.id, ...snap.data() },
  };
}

// ── Get messages for the user's session (paginated) ───────────────────────
// Requires composite index: chat_messages — userId ASC + createdAt ASC
// Create at: https://console.firebase.google.com → Firestore → Indexes → Add index

export async function getMessages(
  userId: string,
  page:   number,
  limit:  number,
) {
  const db = getFirestore();

  // Verify session exists first (cheap direct lookup)
  const sessionSnap = await db.collection(Collections.CHAT_SESSIONS).doc(userId).get();
  if (!sessionSnap.exists) {
    return {
      session:    null,
      messages:   [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    };
  }

  // Fetch messages ordered by createdAt
  // Firestore doesn't support OFFSET — we fetch page*limit and slice
  const snap = await db
    .collection(Collections.CHAT_MESSAGES)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'asc')
    .limit(page * limit)
    .get();

  const all      = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const start    = (page - 1) * limit;
  const messages = all.slice(start, start + limit);

  return {
    session:    { id: sessionSnap.id, ...sessionSnap.data() },
    messages,
    pagination: {
      page,
      limit,
      total:      all.length,
      totalPages: Math.ceil(all.length / limit),
    },
  };
}