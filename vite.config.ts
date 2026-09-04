import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works under a GitHub Pages subpath.
  base: './',
  server: { port: 5173, strictPort: true },
});
