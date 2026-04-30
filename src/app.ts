import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { correlationMiddleware } from './middleware/correlation';
import { httpLogger } from './middleware/httpLogger';
import { rateLimiter } from './middleware/rateLimiter';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler';
import { metricsHandler } from './infrastructure/metrics/prometheus';

// ── Route imports ─────────────────────────────────────────────────────────
import healthRoutes      from './modules/health/health.routes';
import authRoutes        from './modules/auth/auth.routes';
import watchlistRoutes   from './modules/watchlist/watchlist.routes';
import preferencesRoutes from './modules/preferences/preferences.routes';
import marketsRoutes     from './modules/markets/markets.routes';
import indicatorsRoutes  from './modules/indicators/indicators.routes';
import screenerRoutes    from './modules/screener/screener.routes';
import chatbotRoutes     from './modules/chatbot/chatbot.routes';
import stockDetailRoutes from './modules/stock-detail/stock-detail.routes';
import logsRoutes        from './modules/logs/logs.routes';
import docsRoutes        from './modules/docs/swagger';

const app = express();

// ── Security headers ──────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────
// const allowedOrigins = config.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
// app.use(
//   cors({
//     origin: (origin, cb) => {
//       if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
//       return cb(new Error(`Origin ${origin} not allowed by CORS`));
//     },
//     credentials: true,
//     methods:     ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-request-id'],
//   }),
// );

app.use(
  cors({
    origin: true,          // reflect request origin (allow all)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-request-id'],
  }),
);

// optional: ensure preflight works for all routes
app.options('*', cors());

// ── Body parsers ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Correlation IDs (must be before httpLogger) ───────────────────────────
app.use(correlationMiddleware);

// ── HTTP request logging ──────────────────────────────────────────────────
app.use(httpLogger);

// ── Rate limiting (scoped to /api only, in-memory) ────────────────────────
app.use('/api', rateLimiter);

// ── Health + metrics (no auth, no rate limiting) ──────────────────────────
app.use('/health', healthRoutes);
app.get('/metrics', metricsHandler);

// ── API Routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/markets', marketsRoutes);
app.use('/api/indicators', indicatorsRoutes);
app.use('/api/screen', screenerRoutes);
app.use('/api/chat', chatbotRoutes);
app.use('/api/stocks', stockDetailRoutes);
app.use('/api/logs', logsRoutes);

// Swagger UI – /api/docs in dev/staging only
app.use('/api/docs', docsRoutes);

// ── 404 + global error ────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;