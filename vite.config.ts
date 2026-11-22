import { defineConfig } from 'vite';

const publicUrl = process.env.JBCENTRAL_EXPOSED_PORT_URL_5173;
const publicHost = publicUrl ? new URL(publicUrl).hostname : undefined;

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: publicHost ? [publicHost] : [],
    hmr: publicHost ? { host: publicHost, protocol: 'wss', clientPort: 443 } : undefined,
  },
});
