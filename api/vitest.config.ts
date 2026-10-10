import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Les tests partagent une même base : exécution en série.
    fileParallelism: false,
  },
});
