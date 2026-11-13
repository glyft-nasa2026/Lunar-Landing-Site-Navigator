import { defineConfig } from 'vitest/config';

// base './' makes every asset address relative, so the same build works on GitHub Pages under
// any repo name and on the mirror. Data files are loaded with import.meta.env.BASE_URL.
export default defineConfig({
  base: './',
  build: {
    // Plotly alone is about 4.5 MB; the default 500 kB warning would fire on every build.
    chunkSizeWarningLimit: 6000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
