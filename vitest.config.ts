import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // PGlite (WASM Postgres) tests thrash under high file parallelism on this host; keep
    // concurrent files modest so createDabosTestDb stays inside the default 5s testTimeout.
    maxWorkers: 3,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
