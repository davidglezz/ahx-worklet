import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      exclude: [
        '**/*.bench.ts',
        '**/*.d.ts',
        'src/ahx.reference-implementation.js',
        'src/main.ts',
        'src/utils.ts',
        'src/counter.ts',
      ],
    },
    reporters: ['default'],
  },
  build: {
    target: 'esnext',
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: resolve(__dirname, './src'),
      },
    ],
  },
});
