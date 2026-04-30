import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Router } from 'express';
import { config } from '../../config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title:       'Alumnus Trading Platform API',
      version:     '1.0.0',
      description: 'Backend API for the Alumnus Trading Platform. All signals are described as bullish or bearish only — no buy/sell language is used.',
      contact:     { name: 'Raghav Bahety' },
    },
    servers: [
      { url: `http://localhost:${config.PORT}`, description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
          description:  'JWT access token obtained from POST /api/auth/login',
        },
      },
      parameters: {
        SessionId: {
          name:        'x-session-id',
          in:          'header',
          required:    false,
          description: 'Session correlation ID (generated at login, stable per session)',
          schema:      { type: 'string', format: 'uuid' },
        },
      },
      schemas: {
        // ── Envelopes ────────────────────────────────────────────────────
        SuccessEnvelope: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            data:   { type: 'object' },
          },
        },
        ErrorEnvelope: {
          type: 'object',
          properties: {
            status:  { type: 'string', example: 'error' },
            code:    { type: 'string', example: 'INVALID_CREDENTIALS' },
            message: { type: 'string', example: 'Invalid credentials' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            status:  { type: 'string', example: 'error' },
            code:    { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string', example: 'Request validation failed' },
            details: { type: 'object' },
          },
        },
        // ── Domain schemas ───────────────────────────────────────────────
        LoginRequest: {
          type:     'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'premium@alumnus.app' },
            password: { type: 'string', minLength: 8,    example: 'Premium@123' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            accessToken:  { type: 'string' },
            refreshToken: { type: 'string' },
            sessionId:    { type: 'string', format: 'uuid' },
            user: {
              type: 'object',
              properties: {
                id:    { type: 'string', format: 'uuid' },
                name:  { type: 'string' },
                email: { type: 'string', format: 'email' },
                role:  { type: 'string', enum: ['standard', 'premium', 'developer'] },
                theme: { type: 'string', enum: ['light', 'dark'] },
              },
            },
            markets: {
              type:  'array',
              items: {
                type: 'object',
                properties: {
                  id:       { type: 'string', example: 'india' },
                  name:     { type: 'string', example: 'Indian Market' },
                  exchange: { type: 'string', example: 'NSE/BSE' },
                },
              },
            },
            entitledIndicators: {
              type:  'array',
              items: {
                type: 'object',
                properties: {
                  id:          { type: 'string', example: 'RSI_14' },
                  name:        { type: 'string', example: 'Relative Strength Index (14)' },
                  category:    { type: 'string', example: 'momentum' },
                  scale:       { type: 'string', example: 'oscillator' },
                  description: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        WatchlistItem: {
          type: 'object',
          properties: {
            symbol:  { type: 'string', example: 'RELIANCE' },
            addedAt: { type: 'string', format: 'date-time' },
          },
        },
        Preferences: {
          type: 'object',
          properties: {
            preferredIndicators: {
              type:     'array',
              maxItems: 4,
              items:    { type: 'string' },
              example:  ['MACD', 'RSI_14'],
            },
            theme: { type: 'string', enum: ['light', 'dark'] },
          },
        },
        ScreenerRequest: {
          type:     'object',
          required: ['market', 'indicators'],
          properties: {
            market:     { type: 'string', example: 'india' },
            indicators: {
              type:     'array',
              minItems: 1,
              maxItems: 4,
              items:    { type: 'string' },
              example:  ['SMA_20', 'RSI_14'],
            },
          },
        },
        ScreenerResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            data: {
              type: 'object',
              properties: {
                bullish: { type: 'array', items: { type: 'object' } },
                bearish: { type: 'array', items: { type: 'object' } },
                neutral: { type: 'array', items: { type: 'object' } },
              },
            },
            meta: {
              type: 'object',
              properties: {
                generatedAt:        { type: 'string', format: 'date-time' },
                market:             { type: 'string' },
                selectedIndicators: { type: 'array', items: { type: 'string' } },
                dataSource:         { type: 'string', example: 'EOD' },
                fromCache:          { type: 'boolean' },
              },
            },
          },
        },
        ChatMessageRequest: {
          type:     'object',
          required: ['query'],
          properties: {
            query:     { type: 'string', maxLength: 2000, example: 'Which stocks are showing bullish momentum today?' },
            sessionId: { type: 'string', description: 'Omit to start a new chat session' },
            context: {
              type: 'object',
              properties: {
                market:               { type: 'string' },
                selectedIndicators:   { type: 'array', items: { type: 'string' } },
                recentlyViewedStocks: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        PartialStockDetail: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            data: {
              type: 'object',
              properties: {
                metadata:     { type: 'object', nullable: true },
                chart:        { type: 'object', nullable: true },
                indicators:   { type: 'object', nullable: true },
                news:         { type: 'object', nullable: true },
                fundamentals: { type: 'object', nullable: true },
                aiSummary:    { type: 'object', nullable: true },
              },
            },
            meta: {
              type: 'object',
              properties: {
                generatedAt: { type: 'string', format: 'date-time' },
                dataSource:  { type: 'string', example: 'EOD' },
                symbol:      { type: 'string' },
                range:       { type: 'string' },
              },
            },
            errors: {
              type: 'object',
              description: 'Present only when one or more pipeline calls failed. Keys are section names.',
              example: { news: 'Service unavailable' },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth',        description: 'Authentication and session management' },
      { name: 'Watchlist',   description: 'User watchlist management' },
      { name: 'Preferences', description: 'User indicator and theme preferences' },
      { name: 'Markets',     description: 'Available markets for screening' },
      { name: 'Indicators',  description: 'Technical indicator discovery' },
      { name: 'Screener',    description: 'Stock screening (bullish/bearish classification)' },
      { name: 'Chatbot',     description: 'AI analyst assistant (no buy/sell language)' },
      { name: 'Stocks',      description: 'Stock detail aggregation' },
      { name: 'Logs',        description: 'Application log viewer (developer role only)' },
      { name: 'System',      description: 'Health and metrics endpoints' },
    ],
    paths: {
      // ── Auth ─────────────────────────────────────────────────────────
      '/api/auth/login': {
        post: {
          tags:        ['Auth'],
          summary:     'Login and receive tokens + app metadata',
          security:    [],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
          responses: {
            200: { description: 'Login successful', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessEnvelope' }, { properties: { data: { $ref: '#/components/schemas/LoginResponse' } } }] } } } },
            401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
            422: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } } },
          },
        },
      },
      '/api/auth/refresh': {
        post: {
          tags:     ['Auth'],
          summary:  'Rotate refresh token',
          security: [],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } } } } },
          responses: {
            200: { description: 'New tokens issued' },
            401: { description: 'Invalid or expired refresh token' },
          },
        },
      },
      '/api/auth/logout': {
        post: {
          tags:     ['Auth'],
          summary:  'Logout and invalidate refresh token',
          responses: { 200: { description: 'Logged out' }, 401: { description: 'Unauthorized' } },
        },
      },
      '/api/auth/forgot-password': {
        post: {
          tags: ['Auth'], summary: 'Request password reset email', security: [],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } },
          responses: { 200: { description: 'Always 200 to prevent email enumeration' } },
        },
      },
      '/api/auth/reset-password': {
        post: {
          tags: ['Auth'], summary: 'Reset password using token from email', security: [],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['token', 'password'], properties: { token: { type: 'string' }, password: { type: 'string', minLength: 8 } } } } } },
          responses: { 200: { description: 'Password reset' }, 400: { description: 'Invalid or expired token' } },
        },
      },
      // ── Watchlist ─────────────────────────────────────────────────────
      '/api/watchlist': {
        get:  { tags: ['Watchlist'], summary: 'Get user watchlist', responses: { 200: { description: 'Watchlist returned', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, data: { type: 'object', properties: { watchlist: { type: 'array', items: { $ref: '#/components/schemas/WatchlistItem' } } } } } } } } } } },
        post: { tags: ['Watchlist'], summary: 'Add symbol to watchlist', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['symbol'], properties: { symbol: { type: 'string', example: 'INFY' } } } } } }, responses: { 201: { description: 'Symbol added' }, 409: { description: 'Symbol already in watchlist' } } },
      },
      '/api/watchlist/{symbol}': {
        delete: { tags: ['Watchlist'], summary: 'Remove symbol from watchlist', parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }], responses: { 204: { description: 'Removed' }, 404: { description: 'Symbol not in watchlist' } } },
      },
      // ── Preferences ───────────────────────────────────────────────────
      '/api/preferences': {
        get: { tags: ['Preferences'], summary: 'Get saved preferences', responses: { 200: { description: 'Preferences', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessEnvelope' }, { properties: { data: { $ref: '#/components/schemas/Preferences' } } }] } } } } } },
        put: { tags: ['Preferences'], summary: 'Update preferences', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Preferences' } } } }, responses: { 200: { description: 'Updated' }, 403: { description: 'Indicator not entitled' } } },
      },
      // ── Markets ───────────────────────────────────────────────────────
      '/api/markets': {
        get: { tags: ['Markets'], summary: 'List available markets', responses: { 200: { description: 'Markets list' } } },
      },
      // ── Indicators ────────────────────────────────────────────────────
      '/api/indicators': {
        get: { tags: ['Indicators'], summary: 'List indicators entitled to current user', responses: { 200: { description: 'Entitled indicators' } } },
      },
      '/api/indicators/all': {
        get: { tags: ['Indicators'], summary: 'List ALL indicators (developer only)', responses: { 200: { description: 'All indicators' }, 403: { description: 'Insufficient role' } } },
      },
      // ── Screener ──────────────────────────────────────────────────────
      '/api/screen': {
        post: {
          tags:        ['Screener'],
          summary:     'Screen stocks and get bullish/bearish classification',
          description: 'Signals are described as bullish or bearish only. No buy/sell language is used.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ScreenerRequest' } } } },
          responses: {
            200: { description: 'Screener results', content: { 'application/json': { schema: { $ref: '#/components/schemas/ScreenerResponse' } } } },
            400: { description: 'Invalid indicator count (must be 1–4)' },
            403: { description: 'Indicator not entitled' },
          },
        },
      },
      // ── Chatbot ───────────────────────────────────────────────────────
      '/api/chat/message': {
        post: {
          tags:        ['Chatbot'],
          summary:     'Send a message to the AI analyst assistant',
          description: 'The assistant describes conditions as bullish or bearish. It does not use buy/sell language.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatMessageRequest' } } } },
          responses: { 200: { description: 'Assistant response' } },
        },
      },
      '/api/chat/sessions': {
        get: { tags: ['Chatbot'], summary: 'List chat sessions (paginated)', parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }], responses: { 200: { description: 'Sessions list' } } },
      },
      '/api/chat/sessions/{sessionId}/messages': {
        get: { tags: ['Chatbot'], summary: 'Get messages for a session', parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Messages list' }, 404: { description: 'Session not found' } } },
      },
      // ── Stocks ────────────────────────────────────────────────────────
      '/api/stocks/{symbol}': {
        get: {
          tags:        ['Stocks'],
          summary:     'Get aggregated stock detail (parallel pipelines)',
          description: 'Aggregates metadata, OHLCV, indicators (entitled only), news, fundamentals, and AI summary. Returns partial results with structured errors if some pipelines fail.',
          parameters: [
            { name: 'symbol', in: 'path', required: true, schema: { type: 'string', example: 'RELIANCE' } },
            { name: 'range',  in: 'query', schema: { type: 'string', enum: ['1W', '1M', '3M', '1Y'], default: '1M' } },
          ],
          responses: {
            200: { description: 'Stock detail (may be partial)', content: { 'application/json': { schema: { $ref: '#/components/schemas/PartialStockDetail' } } } },
          },
        },
      },
      // ── Logs ──────────────────────────────────────────────────────────
      '/api/logs': {
        get: {
          tags:    ['Logs'],
          summary: 'Query application logs (developer role required)',
          parameters: [
            { name: 'sessionId', in: 'query', schema: { type: 'string' } },
            { name: 'requestId', in: 'query', schema: { type: 'string' } },
            { name: 'userId',    in: 'query', schema: { type: 'string' } },
            { name: 'level',     in: 'query', schema: { type: 'string', enum: ['error', 'warn', 'info', 'http', 'debug'] } },
            { name: 'service',   in: 'query', schema: { type: 'string' } },
            { name: 'from',      in: 'query', schema: { type: 'string', format: 'date-time' } },
            { name: 'to',        in: 'query', schema: { type: 'string', format: 'date-time' } },
            { name: 'page',      in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit',     in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
          ],
          responses: {
            200: { description: 'Paginated log entries' },
            403: { description: 'Developer role required' },
          },
        },
      },
      // ── Health ────────────────────────────────────────────────────────
      '/health': {
        get: { tags: ['System'], summary: 'Liveness check', security: [], responses: { 200: { description: 'Server is running' } } },
      },
      '/health/ready': {
        get: { tags: ['System'], summary: 'Readiness check (Postgres + MongoDB + Redis)', security: [], responses: { 200: { description: 'All dependencies healthy' }, 503: { description: 'One or more dependencies degraded' } } },
      },
      '/metrics': {
        get: { tags: ['System'], summary: 'Prometheus-compatible metrics', security: [], responses: { 200: { description: 'Metrics in text/plain Prometheus format' } } },
      },
    },
  },
  apis: [], // We define paths manually above — no JSDoc scanning needed
};

const swaggerSpec = swaggerJsdoc(options);

const router = Router();

// Serve Swagger UI only in non-production environments
if (config.NODE_ENV !== 'production') {
  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Alumnus API Docs',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  router.get('/spec.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

export default router;
