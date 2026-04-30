import type { Config } from 'jest';
import { config as dotenvConfig } from 'dotenv';

// Load test env vars before any module is imported
dotenvConfig({ path: '.env.test' });

const config: Config = {
  preset:              'ts-jest',
  testEnvironment:     'node',
  rootDir:             '.',
  testMatch:           ['<rootDir>/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  // Auto-clear mocks between tests
  clearMocks:   true,
  resetMocks:   true,
  restoreMocks: true,
  // Verbose output
  verbose: true,
  // Coverage config
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/infrastructure/database/postgres/client.ts',
    '!src/modules/docs/swagger.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches:   65,
      functions:  75,
      lines:      75,
      statements: 75,
    },
  },
};

export default config;