import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['node_modules', 'dist', 'tests/integration_db.test.js', 'tests/e2e_http.test.js'],
    globals: true,
    environment: 'node',
  },
});
