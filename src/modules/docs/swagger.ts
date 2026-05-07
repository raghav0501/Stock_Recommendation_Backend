import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Router } from 'express';
import { config } from '../../config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Alumnus Trading Platform API',
      version: '1.0.0',
      description: 'Backend API for the Alumnus Trading Platform. All signals are described as bullish or bearish only — no buy/sell language is used.',
      contact: { name: 'Raghav Bahety' },
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
          description:  'JWT access token obtained from POST /api/auth/login or POST /api/auth/otp/verify',
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
        OtpRequestBody: {
          type:     'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email', example: 'premium@alumnus.app' },
          },
        },
        OtpVerifyBody: {
          type:     'object',
          required: ['email', 'otp'],
          properties: {
            email: { type: 'string', format: 'email', example: 'premium@alumnus.app' },
            otp:   { type: 'string', minLength: 6, maxLength: 6, pattern: '^\\d{6}$', example: '482910' },
          },
        },
        OtpCooldownError: {
          type: 'object',
          properties: {
            status:           { type: 'string', example: 'error' },
            code:             { type: 'string', example: 'OTP_COOLDOWN' },
            message:          { type: 'string', example: 'Please wait 47 second(s) before requesting a new OTP' },
            retryAfterSeconds: { type: 'integer', example: 47 },
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
         // ── Screener ───────────────────────────────────────────────────
        ScreenerRequest: {
          type:     'object',
          required: ['exchange', 'filters'],
          properties: {
            exchange: { type: 'string', example: 'india', description: 'Exchange identifier' },
            filters: {
              type: 'object',
              description: 'Object whose keys are Python signal names. Values are empty objects {}.',
              example: { rsi_14: {}, sma_50: {} },
              additionalProperties: { type: 'object' },
            },
          },
        },
        ScreenedStock: {
          type: 'object',
          properties: {
            symbol:           { type: 'string', example: 'RELIANCE.NS' },
            latest_price:     { type: 'number', example: 2845.50 },
            price_change_pct: { type: 'number', example: 1.23, description: 'Percentage price change' },
          },
        },
        ScreenerResponse: {
          type: 'object',
          description: 'Direct response from Python pipeline — returned unchanged',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                exchange: { type: 'string', example: 'india' },
                count:    { type: 'integer', example: 42 },
                buy:     { type: 'array', items: { $ref: '#/components/schemas/ScreenedStock' } },
                neutral: { type: 'array', items: { $ref: '#/components/schemas/ScreenedStock' } },
                sell:    { type: 'array', items: { $ref: '#/components/schemas/ScreenedStock' } },
              },
            },
          },
        },
        // ── Backtest ───────────────────────────────────────────────────
        SignalCountRequest: {
          type:     'object',
          required: ['exchange', 'symbol', 'indicator', 'date_from', 'date_to'],
          properties: {
            exchange:  { type: 'string', example: 'india',          description: "Exchange the stock belongs to. Supported values: 'india', 'us'" },
            symbol:    { type: 'string', example: 'TATACOMM.NS',    description: 'Stock ticker symbol as used in the exchange' },
            indicator: { type: 'string', example: 'rsi_14',         description: 'Indicator name' },
            date_from: { type: 'string', format: 'date',            example: '2026-01-01', description: 'Start date of the range (inclusive)' },
            date_to:   { type: 'string', format: 'date',            example: '2026-01-31', description: 'End date of the range (inclusive)' },
          },
        },
        SignalCountChartItem: {
          type: 'object',
          description: 'OHLCV, technical indicator, and signal values for a single trading date',
          required: ['date', 'signal'],
          properties: {
            date:   { type: 'string', format: 'date', example: '2026-01-15' },
            signal: { type: 'integer', enum: [-1, 0, 1], example: 1, description: 'Bull(1), Bear(-1), or Neutral(0)' },
          },
          additionalProperties: true,
        },
        SignalCountResponse: {
          type: 'object',
          description: 'Direct response from Python pipeline — returned unchanged',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              nullable: true,
              properties: {
                exchange:          { type: 'string',  example: 'india' },
                symbol:            { type: 'string',  example: 'TATACOMM.NS' },
                date_from:         { type: 'string',  format: 'date', example: '2026-01-01' },
                date_to:           { type: 'string',  format: 'date', example: '2026-01-31' },
                indicator:         { type: 'string',  example: 'rsi_14' },
                bull_count:        { type: 'integer', example: 18, description: 'Number of bull signal days' },
                bear_count:        { type: 'integer', example: 7,  description: 'Number of bear signal days' },
                plot_chart_signal: {
                  type:     'array',
                  nullable: true,
                  description: 'OHLCV + indicator + signal values sorted by date descending',
                  items: { $ref: '#/components/schemas/SignalCountChartItem' },
                },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
        // ── Stock Details ──────────────────────────────────────────────
        StockDetailsRequest: {
          type:     'object',
          required: ['exchange', 'symbol'],
          properties: {
            exchange:   { type: 'string', example: 'india' },
            symbol:     { type: 'string', example: 'RELIANCE.NS', description: 'Include .NS suffix for NSE stocks' },
            indicators: {
              type:  'array',
              items: { type: 'string' },
              example: ['sma_20', 'rsi_14'],
              description: 'Technical indicator keys to include in the technicals response',
            },
          },
        },
        OHLCVBar: {
          type: 'object',
          properties: {
            time:   { type: 'string', example: '2024-01-15' },
            open:   { type: 'number', example: 2810.00 },
            high:   { type: 'number', example: 2860.00 },
            low:    { type: 'number', example: 2800.00 },
            close:  { type: 'number', example: 2845.50 },
            volume: { type: 'number', example: 5432100 },
          },
        },
        StockDetailsResponse: {
          type: 'object',
          description: 'Direct response from Python pipeline — returned unchanged',
          properties: {
            success:    { type: 'boolean' },
            metadata: {
              type: 'object',
              nullable: true,
              properties: {
                company_name: { type: 'string', example: 'Reliance Industries Limited' },
                sector:       { type: 'string', example: 'Energy' },
                industry:     { type: 'string', example: 'Oil & Gas' },
                description:  { type: 'string' },
                website:      { type: 'string', example: 'https://www.ril.com' },
                country:      { type: 'string', example: 'India' },
                employees:    { type: 'integer', example: 236334 },
              },
            },
            ohlcv:      { type: 'array', items: { $ref: '#/components/schemas/OHLCVBar' } },
            technicals: {
              type:  'array',
              description: 'One object per date with requested indicator values',
              items: {
                type: 'object',
                properties: {
                  time:       { type: 'string', example: '2024-01-15' },
                  sma_20:     { type: 'number', nullable: true },
                  rsi_14:     { type: 'number', nullable: true },
                  macd:       { type: 'number', nullable: true },
                  bb_upper:   { type: 'number', nullable: true },
                  bb_lower:   { type: 'number', nullable: true },
                },
                additionalProperties: { type: 'number', nullable: true },
              },
            },
            summary: { type: 'string', description: 'AI-generated text summary of technical conditions' },
          },
        },
 
        // ── Stock Snapshot / Fundamentals ──────────────────────────────
        StockFundamentals: {
          type: 'object',
          properties: {
            symbol:        { type: 'string', example: 'RELIANCE.NS' },
            date:          { type: 'string', example: '2024-01-15' },
            open:          { type: 'number', example: 2810.00 },
            high:          { type: 'number', example: 2860.00 },
            low:           { type: 'number', example: 2800.00 },
            close:         { type: 'number', example: 2845.50 },
            volume:        { type: 'number', example: 5432100 },
            avg_volume:    { type: 'number', example: 6100000 },
            trailing_pe:   { type: 'number', example: 27.4 },
            forward_pe:    { type: 'number', example: 22.1 },
            market_cap:    { type: 'number', example: 19247000000000 },
            eps:           { type: 'number', example: 103.8 },
            high_52w:      { type: 'number', example: 3024.90 },
            low_52w:       { type: 'number', example: 2220.30 },
            price_to_book: { type: 'number', example: 2.18 },
          },
        },
        StockSnapshotResponse: {
          type: 'object',
          description: 'Direct response from Python pipeline — returned unchanged',
          properties: {
            exchange:   { type: 'string', example: 'india' },
            ticker:     { type: 'string', example: 'RELIANCE.NS' },
            currency:   { type: 'string', example: 'INR' },
            stock_data: { $ref: '#/components/schemas/StockFundamentals' },
          },
        },
 
        // ── News ───────────────────────────────────────────────────────
        NewsArticle: {
          type: 'object',
          properties: {
            news_id:        { type: 'string' },
            title:          { type: 'string', example: 'Reliance reports record quarterly profit' },
            url:            { type: 'string', format: 'uri' },
            source:         { type: 'string', example: 'Economic Times' },
            published_date: { type: 'string', example: '2024-01-15T10:30:00Z' },
            description:    { type: 'string' },
            thumbnail_url:  { type: 'string', format: 'uri' },
            score:          { type: 'number', example: 0.87 },
          },
        },
        StockNewsResponse: {
          type: 'object',
          description: 'Direct response from Python pipeline — returned unchanged',
          properties: {
            success:             { type: 'boolean' },
            ticker:              { type: 'string', example: 'RELIANCE.NS' },
            rss_news:            { type: 'array', items: { $ref: '#/components/schemas/NewsArticle' } },
            rss_news_count:      { type: 'integer' },
            rss_summary:         { type: 'string' },
            telegram_news:       { type: 'array', items: { $ref: '#/components/schemas/NewsArticle' } },
            telegram_news_count: { type: 'integer' },
            telegram_summary:    { type: 'string' },
            full_summary:        { type: 'string', description: 'Combined AI news summary' },
            error:               { type: 'string', nullable: true },
          },
        },

        // ── Chatbot ────────────────────────────────────────────────────
        ChatRequest: {
          type:     'object',
          required: ['message'],
          properties: {
            message: {
              type:      'string',
              maxLength: 5000,
              example:   'Which Indian stocks are showing bullish momentum based on RSI?',
              description: 'User\'s natural language query to the AI analyst',
            },
            session_id: {
              type:        'string',
              description: 'Session ID for conversation memory. Omit to use the login session ID.',
              example:     'd82314f5-0a35-4b65-a29e-ce6d4dd75fc2',
            },
          },
        },
        PlotData: {
          type: 'object',
          description: 'Chart data returned by the AI analyst for rendering in the frontend',
          properties: {
            type: {
              type: 'string',
              enum: ['ohlcv', 'returns', 'chart_with_indicators', 'chart_with_backtest_results'],
            },
            start_date: { type: 'string', example: '2023-01-01' },
            end_date:   { type: 'string', example: '2024-01-15' },
            data:       { type: 'object', description: 'Plot payload — structure depends on type' },
          },
        },
        ChatResponse: {
          type: 'object',
          description: 'Direct response from Python chatbot pipeline — returned unchanged',
          properties: {
            query:             { type: 'string', description: 'The user\'s original message' },
            classification:    {
              type: 'object',
              properties: {
                action:   { type: 'string', example: 'stock_analysis' },
                response: { type: 'string', nullable: true },
              },
            },
            final_response:    { type: 'string', description: 'AI analyst\'s text response' },
            plots:             { type: 'array', items: { $ref: '#/components/schemas/PlotData' }, description: 'Charts to render in the frontend' },
            news:              {
              type:  'array',
              description: 'Relevant news articles',
              items: {
                type: 'object',
                properties: {
                  title:         { type: 'string' },
                  url:           { type: 'string' },
                  source:        { type: 'string' },
                  publishedDate: { type: 'string' },
                  summary:       { type: 'string' },
                },
              },
            },
            memory: {
              type: 'object',
              properties: {
                used:             { type: 'boolean' },
                history_length:   { type: 'integer' },
                recent_context:   { type: 'string', nullable: true },
              },
            },
          },
        },
 
        // ── Chat History (Firestore) ───────────────────────────────────
        ChatSession: {
          type: 'object',
          properties: {
            id:        { type: 'string' },
            userId:    { type: 'string' },
            updatedAt: { type: 'string', format: 'date-time' },
            isActive:  { type: 'boolean' },
          },
        },
        ChatHistoryMessage: {
          type: 'object',
          properties: {
            id:            { type: 'string' },
            sessionId:     { type: 'string' },
            userMessage:   { type: 'string' },
            finalResponse: { type: 'string' },
            action:        { type: 'string' },
            hasPlots:      { type: 'boolean' },
            hasNews:       { type: 'boolean' },
            createdAt:     { type: 'string', format: 'date-time' },
          },
        },
 
        // ── Market Indices ─────────────────────────────────────────────
        IndicesResponse: {
          type: 'object',
          description: 'Direct response from Python pipeline — returned unchanged',
          properties: {
            indices: {
              type: 'object',
              description: 'Keys are index names e.g. "NIFTY 50", "SENSEX"',
              additionalProperties: {
                type: 'object',
                properties: {
                  open:       { type: 'number' },
                  close:      { type: 'number' },
                  pct_change: { type: 'number' },
                  date:       { type: 'string' },
                },
              },
              example: {
                'NIFTY 50': { open: 22100.5, close: 22350.2, pct_change: 1.13, date: '2024-01-15' },
                'SENSEX':   { open: 72800.0, close: 73500.0, pct_change: 0.96, date: '2024-01-15' },
              },
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
      { name: 'Backtest',    description: 'Signal count and backtest analysis over a date range' },
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
      // ── OTP auth ──────────────────────────────────────────────────────
      '/api/auth/otp/request': {
        post: {
          tags:        ['Auth'],
          summary:     'Request a one-time password via email',
          description: 'Generates a 6-digit OTP, stores a hashed copy in the database, and emails it to the registered address. Always returns 200 regardless of whether the email is registered (prevents enumeration). A 1-minute cooling period applies per email address.',
          security:    [],
          requestBody: {
            required: true,
            content:  { 'application/json': { schema: { $ref: '#/components/schemas/OtpRequestBody' } } },
          },
          responses: {
            200: {
              description: 'OTP sent (or silently ignored if email is not registered)',
              content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessEnvelope' }, { properties: { data: { type: 'object', properties: { message: { type: 'string', example: 'If that email is registered, an OTP has been sent.' } } } } }] } } },
            },
            422: { description: 'Validation error — invalid email format',    content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } } },
            429: { description: 'Cooling period active — retry too soon',     content: { 'application/json': { schema: { $ref: '#/components/schemas/OtpCooldownError' } } } },
          },
        },
      },
      '/api/auth/otp/verify': {
        post: {
          tags:        ['Auth'],
          summary:     'Verify OTP and receive auth tokens',
          description: 'Validates the 6-digit OTP. On success the OTP is deleted (single-use) and the full login payload is returned — identical to `/api/auth/login`. OTPs expire after 5 minutes.',
          security:    [],
          requestBody: {
            required: true,
            content:  { 'application/json': { schema: { $ref: '#/components/schemas/OtpVerifyBody' } } },
          },
          responses: {
            200: {
              description: 'OTP valid — tokens issued',
              content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessEnvelope' }, { properties: { data: { $ref: '#/components/schemas/LoginResponse' } } }] } } },
            },
            401: { description: 'Invalid or expired OTP', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
            422: { description: 'Validation error',       content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } } },
          },
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
          summary:     'Screen stocks by technical signals',
          description: 'Calls Python POST /api/screen and returns the response unchanged.\n\nUse GET /api/signals to get available signal names for the filters object.\n\n**Signal names from Python use buy/sell language internally — but the signals themselves describe technical conditions, not investment advice.**',
          requestBody: {
            required: true,
            content:  { 'application/json': { schema: { $ref: '#/components/schemas/ScreenerRequest' } } },
          },
          responses: {
            200: {
              description: 'Screener results with buy/neutral/sell categorised stocks',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ScreenerResponse' } } },
            },
            401: { description: 'Unauthorized' },
            502: { description: 'Python pipeline unavailable' },
          },
        },
      },
      // ── Backtest ──────────────────────────────────────────────────────
      '/api/backtest/signalcount': {
        post: {
          tags:        ['Backtest'],
          summary:     'Get bull and bear signal count for a stock over a date range',
          description: 'Calls Python POST /api/signalcount and returns the response unchanged.\n\nReturns the number of bull and bear signal days for the given indicator, plus per-day OHLCV + signal data for charting.',
          requestBody: {
            required: true,
            content:  { 'application/json': { schema: { $ref: '#/components/schemas/SignalCountRequest' } } },
          },
          responses: {
            200: {
              description: 'Signal counts and per-day chart data',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/SignalCountResponse' } } },
            },
            401: { description: 'Unauthorized' },
            422: { description: 'Validation error — missing or invalid fields' },
            502: { description: 'Python pipeline unavailable' },
          },
        },
      },
      // ── Chatbot ───────────────────────────────────────────────────────
      '/api/chat/respond': {
        post: {
          tags:        ['Chatbot'],
          summary:     'Send a message to the AI analyst',
          description: 'Calls Python POST /api/chat/respond. Returns the Python response unchanged.\n\nThe conversation is also persisted to Firestore for history (non-blocking).\n\nThe `session_id` in the request body controls Python\'s conversation memory. Omit it to use the login session ID automatically.',
          requestBody: {
            required: true,
            content:  { 'application/json': { schema: { $ref: '#/components/schemas/ChatRequest' } } },
          },
          responses: {
            200: {
              description: 'AI analyst response with optional plots and news',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatResponse' } } },
            },
            401: { description: 'Unauthorized' },
            502: { description: 'Python pipeline unavailable' },
          },
        },
      },
 
      '/api/chat/session': {
        get: {
          tags:        ['Chatbot'],
          summary:     'List chat sessions for the current user (from Firestore)',
          parameters: [
            { name: 'page',  in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 } },
          ],
          responses: {
            200: {
              description: 'Paginated sessions',
              content: { 'application/json': { schema: { allOf: [
                { $ref: '#/components/schemas/SuccessEnvelope' },
                { properties: { data: { type: 'object', properties: { sessions: { type: 'array', items: { $ref: '#/components/schemas/ChatSession' } }, pagination: { type: 'object' } } } } },
              ] } } },
            },
          },
        },
      },
 
      '/api/chat/messages': {
        get: {
          tags:        ['Chatbot'],
          summary:     'Get message history for a session (from Firestore)',
          parameters: [
            { name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'page',      in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit',     in: 'query', schema: { type: 'integer', default: 50 } },
          ],
          responses: {
            200: {
              description: 'Message history',
              content: { 'application/json': { schema: { allOf: [
                { $ref: '#/components/schemas/SuccessEnvelope' },
                { properties: { data: { type: 'object', properties: { messages: { type: 'array', items: { $ref: '#/components/schemas/ChatHistoryMessage' } }, pagination: { type: 'object' } } } } },
              ] } } },
            },
            404: { description: 'Session not found or belongs to a different user' },
          },
        },
      },
      // ── Stocks ────────────────────────────────────────────────────────
      '/api/stock-details': {
        post: {
          tags:        ['Stocks'],
          summary:     'Get OHLCV + technical indicators + AI summary for a stock',
          description: 'Calls Python POST /api/stock-details. Returns the Python response unchanged.\n\nFor Indian stocks include `.NS` suffix: `RELIANCE.NS`',
          requestBody: {
            required: true,
            content:  { 'application/json': { schema: { $ref: '#/components/schemas/StockDetailsRequest' } } },
          },
          responses: {
            200: {
              description: 'Stock details',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/StockDetailsResponse' } } },
            },
            401: { description: 'Unauthorized' },
            502: { description: 'Python pipeline unavailable' },
          },
        },
      },
 
      '/api/stock-details/stock_snapshot/{exchange}/{symbol}': {
        post: {
          tags:        ['Stocks'],
          summary:     'Get fundamental snapshot for a stock (P/E, market cap, 52w high/low etc.)',
          description: 'Calls Python POST /api/stock_snapshot/:exchange/:symbol. Returns the Python response unchanged.',
          parameters: [
            { name: 'exchange', in: 'path', required: true, schema: { type: 'string', example: 'india' } },
            { name: 'symbol',   in: 'path', required: true, schema: { type: 'string', example: 'RELIANCE.NS' } },
          ],
          responses: {
            200: {
              description: 'Fundamental snapshot',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/StockSnapshotResponse' } } },
            },
            401: { description: 'Unauthorized' },
            502: { description: 'Python pipeline unavailable' },
          },
        },
      },
 
      '/api/stock-details/news/stock/combined/{symbol}': {
        get: {
          tags:        ['Stocks'],
          summary:     'Get combined RSS + Telegram news for a stock',
          description: 'Calls Python GET /api/news/stock/combined/:symbol. Returns the Python response unchanged.',
          parameters: [
            { name: 'symbol', in: 'path', required: true, schema: { type: 'string', example: 'RELIANCE.NS' } },
          ],
          responses: {
            200: {
              description: 'News articles and AI-generated summary',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/StockNewsResponse' } } },
            },
            401: { description: 'Unauthorized' },
            502: { description: 'Python pipeline unavailable' },
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
