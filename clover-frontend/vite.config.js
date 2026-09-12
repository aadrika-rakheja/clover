import { defineConfig } from 'vite';

/**
 * Vite configuration for the Clover CDN-based frontend.
 *
 * The frontend uses Babel standalone + CDN scripts (no bundling needed).
 * Vite is used purely as a dev server for:
 *   - Hot-reloading static file changes
 *   - Proxying API requests to the Node backend (avoids CORS in dev)
 *
 * Production: deploy the static files with any HTTP server (Nginx, Caddy, etc.)
 * and point CLOVER_API_URL in index.html to your production API domain.
 */
export default defineConfig({
  // Serve from project root so index.html, style.css, src/, assets/ all work
  root: '.',

  server: {
    port: 5173,
    open: false,

    proxy: {
      // All /api requests and /health → Node backend
      // This means fetch('/api/v1/...') works without CORS issues in dev.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // Ensure static assets (assets/, style.css) are served from root
  publicDir: 'assets',

  build: {
    // No bundling — just copy all files for production deploy
    rollupOptions: {
      input: 'index.html',
    },
  },
});
