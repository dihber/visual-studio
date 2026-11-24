import { defineConfig } from 'vitest/config';

const TEST_DB =
  process.env.TEST_DATABASE_URL ??
  'postgresql://dihber:dihber@localhost:5432/dihber_vendas_test?schema=public';

export default defineConfig({
  test: {
    env: { DATABASE_URL: TEST_DB, JWT_SECRET: 'segredo-de-teste', LOGIN_RATE_LIMIT: '20' },
    globalSetup: './test/global-setup.ts',
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
