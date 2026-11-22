import { defineConfig } from 'vite';

// In an Air cloud task, an exposed port's public URL arrives as
// JBCENTRAL_EXPOSED_PORT_URL_5173. Behind that HTTPS proxy the dev server must
// listen on 0.0.0.0, accept the proxy's Host header, and point the hot-reload
// socket at the public origin (port 443) instead of localhost.
const publicUrl = process.env.JBCENTRAL_EXPOSED_PORT_URL_5173;
const publicHost = publicUrl ? new URL(publicUrl).hostname : undefined;

export default defineConfig({
  // Relative asset paths so the build works under a GitHub Pages subpath.
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: publicHost ? [publicHost] : [],
    hmr: publicHost ? { host: publicHost, protocol: 'wss', clientPort: 443 } : undefined,
  },
});
