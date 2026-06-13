import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  splitting: false,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
