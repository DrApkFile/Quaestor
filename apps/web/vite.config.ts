import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import react from '@vitejs/plugin-react';
import handler from '../../api/qore-relay.js';
const config = z
  .object({ headers: z.array(z.object({ headers: z.array(z.object({ key: z.string(), value: z.string() })) })) })
  .parse(JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')));
const headers = Object.fromEntries(
  config.headers.flatMap((row) => row.headers.map((header) => [header.key, header.value])),
);
function relay(request: IncomingMessage, response: ServerResponse, next: () => void) {
  if (request.url?.startsWith('/api/qore/') || request.url?.startsWith('/api/qore-relay?'))
    void handler(request, response);
  else next();
}
export default defineConfig({
  preview: { headers },
  plugins: [
    react(),
    {
      name: 'local-qore-relay',
      configurePreviewServer(server) {
        server.middlewares.use(relay);
      },
      configureServer(server) {
        server.middlewares.use(relay);
      },
    },
  ],
  resolve: { alias: { events: 'events/' } },
  optimizeDeps: { include: ['buffer', 'events'] },
  server: { fs: { deny: ['**/.accounts/**', '**/.env*', '**/*.key', '**/*.mnemonic'] } },
});
