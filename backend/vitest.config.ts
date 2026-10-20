import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-value-at-least-32-chars',
      MONGOMS_VERSION: '7.0.24',
      RATE_LIMIT_MAX: '1000',
      AUTH_RATE_LIMIT_MAX: '1000',
      BCRYPT_SALT_ROUNDS: '4',
    },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
    fileParallelism: false,
  },
});
