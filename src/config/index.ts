import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().default('3000').transform(Number),

  // ── Cloud SQL (PostgreSQL) ─────────────────────────────────────────────
  // Local dev:    postgresql://USER:PASS@localhost:5432/alumnus_db
  // Cloud SQL:    postgresql://USER:PASS@/alumnus_db?host=/cloudsql/PROJECT:REGION:INSTANCE
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // ── Firebase ───────────────────────────────────────────────────────────
  // Path to your Firebase service account JSON key file
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().min(1, 'FIREBASE_SERVICE_ACCOUNT_PATH is required'),
  // Your Firebase project ID
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_DATABASE_ID: z.string().default('(default)'),

  // ── JWT ────────────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_EXPIRES_IN: z.string().default('360m'),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  REFRESH_TOKEN_ENCRYPTION_KEY: z.string().min(32),

  // ── CORS ───────────────────────────────────────────────────────────────
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  // ── Rate Limiting (in-memory, sufficient for small user base) ─────────
  RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform(Number),
  RATE_LIMIT_MAX: z.string().default('100').transform(Number),

  // ── Logging ────────────────────────────────────────────────────────────
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_RETENTION_DAYS: z.string().default('90').transform(Number),

  // ── Screener (no cache — direct pipeline calls) ────────────────────────
  SCREENER_MAX_RESULTS_PER_CATEGORY: z.string().default('50').transform(Number),

  // ── Pipeline config ────────────────────────────────────────────────────
  PIPELINE_TIMEOUT_MS: z.string().default('5000').transform(Number),
  PIPELINE_SCREENER_URL: z.string().default('http://localhost:8001'),
  PIPELINE_TECHNICAL_URL: z.string().default('http://localhost:8002'),
  PIPELINE_FUNDAMENTAL_URL: z.string().default('http://localhost:8003'),
  PIPELINE_NEWS_SEARCH_URL: z.string().default('http://localhost:8004'),
  PIPELINE_CHATBOT_URL: z.string().default('http://localhost:8007'),

    // ── Python FastAPI monolith (existing Cloud Run service) ────────────────
  // Each backend module calls the relevant Python endpoint directly.
  PYTHON_API_BASE_URL: z.string().default('https://demo2-664110982097.us-central1.run.app'),

  // ── Email / SMTP ───────────────────────────────────────────────────────────
  EMAIL_FROM: z.string().default('noreply@alumnus.app'),
  PASSWORD_RESET_TOKEN_TTL_SECONDS: z.string().default('900').transform(Number),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_SECURE: z.string().default('false').transform((v) => v === 'true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),

  // ── OTP ────────────────────────────────────────────────────────────────────
  OTP_HMAC_SECRET: z.string().min(32, 'OTP_HMAC_SECRET must be at least 32 characters'),
  OTP_TTL_SECONDS: z.string().default('300').transform(Number),
  OTP_COOLING_SECONDS: z.string().default('60').transform(Number),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  process.stderr.write('Invalid environment variables:\n');
  process.stderr.write(JSON.stringify(parsed.error.format(), null, 2) + '\n');
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;