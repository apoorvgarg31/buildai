import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    root: path.resolve(__dirname),
    include: ['__tests__/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});
