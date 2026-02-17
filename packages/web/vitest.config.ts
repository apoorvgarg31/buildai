import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    exclude: ['node_modules/**', '.next/**'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
