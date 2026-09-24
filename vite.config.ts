import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { mexcProxy } from './server/mexc-proxy.mjs';
export default defineConfig({ plugins: [react(), {
  name: 'mexc-public-data',
  configureServer(server) { server.middlewares.use(mexcProxy); },
  configurePreviewServer(server) { server.middlewares.use(mexcProxy); },
}], test: { include: ['tests/**/*.test.ts'] } });
