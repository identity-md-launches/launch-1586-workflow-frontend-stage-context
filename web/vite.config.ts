/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// In `vite dev`, serve the committed runtime deployment manifest from ../dist so the
// app reads the same file it reads in production. There is no second copy of it.
function serveDeploymentManifest(): Plugin {
  return {
    name: 'serve-imd-deployment',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] === '/imd-deployment.json') {
          const file = resolve(__dirname, '../dist/imd-deployment.json');
          if (existsSync(file)) {
            res.setHeader('content-type', 'application/json');
            res.end(readFileSync(file));
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), serveDeploymentManifest()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
