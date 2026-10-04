import { defineConfig } from 'vitest/config';

// Separate config: the unit tests do not need the Svelte or PWA plugins
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
