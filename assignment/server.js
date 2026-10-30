import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { config } from './src/config.js';
import { connectDatabase, disconnectDatabase } from './src/db.js';
import { apiRouter, redirectRouter } from './src/routes.js';
import { ValidationError } from './src/url-utils.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // so req.protocol is https behind a proxy

app.use(express.json({ limit: '10kb' }));
app.use(express.static(publicDir));

app.use('/api', apiRouter);
app.use(redirectRouter); // GET /:code -> 302

// 404 — JSON for the API, a page for anything else.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found.' });
  }
  res.status(404).sendFile(path.join(publicDir, '404.html'));
});

// eslint-disable-next-line no-unused-vars -- Express needs all four arguments
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }

  console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

async function start() {
  await connectDatabase();

  const server = app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
  });

  // listen() reports failures as an event, not a rejection, so start().catch()
  // never sees this one — without it, a busy port prints a raw stack trace.
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[server] Port ${config.port} is already in use.`);
      console.error('[server] Stop the process using it, or set a different PORT in .env.');
      process.exit(1);
    }
    throw err;
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      console.log(`\n[server] ${signal} received, shutting down`);
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    });
  }
}

start().catch((err) => {
  console.error('[startup] failed to start:', err.message);
  console.error('[startup] Is MONGODB_URI in .env correct, and is MongoDB reachable?');
  process.exit(1);
});
