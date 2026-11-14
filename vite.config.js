import { defineConfig } from 'vite';
import worker from './worker/index.js';

/**
 * Runs the Cloudflare Worker's fetch handler as Vite dev middleware, so the
 * bird's web access, GitHub access and site forge behave the same locally as
 * they do once deployed.
 */
function workerDevApi() {
  return {
    name: 'nesbit-worker-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        try {
          const url = new URL(req.url, 'http://localhost');
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const method = req.method || 'GET';
          const request = new Request(url, {
            method,
            headers: req.headers,
            body: method === 'GET' || method === 'HEAD' ? undefined : body,
          });
          const response = await worker.fetch(request, {
            OPENAI_API_KEY: process.env.OPENAI_API_KEY,
            OPENAI_MODEL: process.env.OPENAI_MODEL,
            GITHUB_TOKEN: process.env.GITHUB_TOKEN,
          });
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: String(error && error.message ? error.message : error) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [workerDevApi()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
