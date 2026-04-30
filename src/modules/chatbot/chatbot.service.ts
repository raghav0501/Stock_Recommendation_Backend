/**
 * Chatbot service — now backed by Firestore instead of MongoDB/Mongoose.
 *
 * Collections:
 *   chat_sessions/{sessionId}               – session metadata
 *   chat_messages/{messageId}               – individual messages
 */
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import { config } from '../../config';
import { getFirestore, Collections } from '../../infrastructure/firebase/client';
import { createServiceLogger } from '../../infrastructure/logger';
import { chatbotPipelineResponseSchema } from './chatbot.schema';

const log = createServiceLogger('chatbot');

interface ChatContext {
  sessionId: string;
  requestId: string;
  userId:    string;
}

interface UserContext {
  market?:               string;
  selectedIndicators?:   string[];
  recentlyViewedStocks?: string[];
}

// ── Firestore document shapes ──────────────────────────────────────────────
interface ChatSessionDoc {
  id:        string;
  userId:    string;
  title:     string;
  context?:  UserContext;
  isActive:  boolean;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessageDoc {
  id:        string;
  sessionId: string;
  userId:    string;
  role:      'user' | 'assistant';
  content:   string;
  plots?:    unknown[];
  news?:     unknown[];
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function now(): string {
  return new Date().toISOString();
}

// ── Send a message ─────────────────────────────────────────────────────────
export async function sendMessage(
  userId:        string,
  query:         string,
  chatSessionId: string | undefined,
  userContext:   UserContext | undefined,
  ctx:           ChatContext,
) {
  const db = getFirestore();

  // ── Resolve or create session ──────────────────────────────────────────
  let session: ChatSessionDoc;

  if (chatSessionId) {
    const snap = await db.collection(Collections.CHAT_SESSIONS).doc(chatSessionId).get();
    if (!snap.exists || (snap.data() as ChatSessionDoc).userId !== userId) {
      throw Object.assign(new Error('Chat session not found'), {
        statusCode: StatusCodes.NOT_FOUND, code: 'SESSION_NOT_FOUND',
      });
    }
    session = { id: snap.id, ...snap.data() } as ChatSessionDoc;
  } else {
    const newId = uuidv4();
    session = {
      id:        newId,
      userId,
      title:     query.slice(0, 60),
      context:   userContext,
      isActive:  true,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.collection(Collections.CHAT_SESSIONS).doc(newId).set(session);
    log.info('New chat session created', { ...ctx, meta: { chatSessionId: newId } });
  }

  // ── Persist user message ───────────────────────────────────────────────
  const userMsgId  = uuidv4();
  const userMsgDoc: ChatMessageDoc = {
    id:        userMsgId,
    sessionId: session.id,
    userId,
    role:      'user',
    content:   query,
    createdAt: now(),
  };
  await db.collection(Collections.CHAT_MESSAGES).doc(userMsgId).set(userMsgDoc);

  // ── Call chatbot pipeline ──────────────────────────────────────────────
  const start = Date.now();
  let assistantText: string;
  let plots: unknown[] = [];
  let news:  unknown[] = [];
  let signalSummary: unknown = null;

  try {
    const response = await axios.post(
      `${config.PIPELINE_CHATBOT_URL}/chat`,
      {
        query,
        context: {
          market:      userContext?.market,
          indicators:  userContext?.selectedIndicators,
          recentStocks: userContext?.recentlyViewedStocks,
        },
        userId,
      },
      {
        timeout: config.PIPELINE_TIMEOUT_MS,
        headers: {
          'x-session-id': ctx.sessionId,
          'x-request-id': ctx.requestId,
        },
      },
    );

    const latencyMs = Date.now() - start;
    const parsed    = chatbotPipelineResponseSchema.safeParse(response.data);

    if (!parsed.success) {
      log.error('Chatbot pipeline schema invalid', {
        ...ctx, meta: { errors: parsed.error.flatten() },
      });
      throw Object.assign(new Error('Chatbot returned an invalid response'), {
        statusCode: StatusCodes.BAD_GATEWAY, code: 'PIPELINE_SCHEMA_ERROR',
      });
    }

    assistantText = parsed.data.text;
    plots         = parsed.data.plots;
    news          = parsed.data.newsSnippets;
    signalSummary = parsed.data.signalSummary ?? null;

    log.pipelineCall('chatbot', latencyMs, 'success', ctx);

  } catch (err) {
    const latencyMs = Date.now() - start;
    if ((err as { code?: string }).code === 'PIPELINE_SCHEMA_ERROR') throw err;

    log.pipelineCall('chatbot', latencyMs, 'error', ctx, String(err));
    log.warn('Chatbot pipeline unavailable – returning dummy response', ctx);
    assistantText = _dummyResponse(query);
  }

  // ── Persist assistant message ──────────────────────────────────────────
  const asstMsgId  = uuidv4();
  const asstMsgDoc: ChatMessageDoc = {
    id:        asstMsgId,
    sessionId: session.id,
    userId,
    role:      'assistant',
    content:   assistantText,
    plots,
    news,
    createdAt: now(),
  };
  await db.collection(Collections.CHAT_MESSAGES).doc(asstMsgId).set(asstMsgDoc);

  // ── Update session timestamp ───────────────────────────────────────────
  await db.collection(Collections.CHAT_SESSIONS)
    .doc(session.id)
    .update({ updatedAt: now() });

  log.info('Chat message handled', { ...ctx, meta: { chatSessionId: session.id } });

  return {
    sessionId: session.id,
    message: {
      id:           asstMsgId,
      role:         'assistant',
      content:      assistantText,
      plots,
      news,
      signalSummary,
      createdAt:    asstMsgDoc.createdAt,
    },
  };
}

// ── Get sessions list (paginated) ─────────────────────────────────────────
export async function getSessions(
  userId: string,
  page:   number,
  limit:  number,
  ctx:    ChatContext,
) {
  const db = getFirestore();

  const snap = await db
    .collection(Collections.CHAT_SESSIONS)
    .where('userId', '==', userId)
    .orderBy('updatedAt', 'desc')
    .limit(page * limit)
    .get();

  const allSessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const start       = (page - 1) * limit;
  const sessions    = allSessions.slice(start, start + limit);

  log.info('Chat sessions listed', { ...ctx });

  return {
    sessions,
    pagination: {
      page,
      limit,
      total:      allSessions.length,
      totalPages: Math.ceil(allSessions.length / limit),
    },
  };
}

// ── Get messages for a session (paginated) ────────────────────────────────
export async function getSessionMessages(
  userId:        string,
  chatSessionId: string,
  page:          number,
  limit:         number,
  ctx:           ChatContext,
) {
  const db = getFirestore();

  // Verify session belongs to user
  const sessionSnap = await db.collection(Collections.CHAT_SESSIONS).doc(chatSessionId).get();
  if (!sessionSnap.exists || (sessionSnap.data() as ChatSessionDoc).userId !== userId) {
    throw Object.assign(new Error('Session not found'), {
      statusCode: StatusCodes.NOT_FOUND, code: 'SESSION_NOT_FOUND',
    });
  }

  const snap = await db
    .collection(Collections.CHAT_MESSAGES)
    .where('sessionId', '==', chatSessionId)
    .orderBy('createdAt', 'asc')
    .limit(page * limit)
    .get();

  const allMessages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const start       = (page - 1) * limit;
  const messages    = allMessages.slice(start, start + limit);

  log.info('Chat messages listed', { ...ctx, meta: { chatSessionId } });

  return {
    session:    { id: sessionSnap.id, ...sessionSnap.data() },
    messages,
    pagination: {
      page,
      limit,
      total:      allMessages.length,
      totalPages: Math.ceil(allMessages.length / limit),
    },
  };
}

// ── Dummy response ─────────────────────────────────────────────────────────
function _dummyResponse(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('bullish') || q.includes('good')) {
    return 'Based on recent technical indicators, several stocks are showing bullish momentum. (Note: placeholder response — AI analyst pipeline not yet connected.)';
  }
  if (q.includes('bearish') || q.includes('bad')) {
    return 'Current technical analysis indicates bearish conditions for several securities. (Note: placeholder response — AI analyst pipeline not yet connected.)';
  }
  return `You asked: "${query}". The AI analyst pipeline is not yet connected. Once live, I will analyse stocks using technical indicators and describe conditions as bullish or bearish only. I do not provide buy or sell advice.`;
}