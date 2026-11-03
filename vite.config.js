import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative paths, so the built site works in a subfolder such as GitHub Pages' username.github.io/repo/
  server: { open: true, port: 5173 },
  build: { chunkSizeWarningLimit: 1200 }, // three.js (~500 kB) + KaTeX (~270 kB)

  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
