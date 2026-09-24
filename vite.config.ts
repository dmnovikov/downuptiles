import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { worldData } from './server/world-data.mjs';
import { mexcProxy } from './server/mexc-proxy.mjs';
export default defineConfig({ plugins: [react(), {
  name: 'mexc-public-data',
  configureServer(server) { server.middlewares.use(mexcProxy); server.middlewares.use(worldData); },
  configurePreviewServer(server) { server.middlewares.use(mexcProxy); server.middlewares.use(worldData); },
}], test: { include: ['tests/**/*.test.ts'] } });
