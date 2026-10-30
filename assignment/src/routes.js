import { Router } from 'express';
import { config } from './config.js';
import { isDatabaseReady } from './db.js';
import { Url } from './url.model.js';
import { generateShortCode, normalizeUrl, SHORT_CODE_PATTERN } from './url-utils.js';

/** Express 4 doesn't catch rejected promises from handlers, so hand them to next(). */
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const DB_DOWN_MESSAGE =
  'Database unavailable. Check MONGODB_URI in .env and that your MongoDB server is running.';

function buildShortUrl(req, code) {
  const base = config.baseUrl || `${req.protocol}://${req.get('host')}`;
  return `${base}/${code}`;
}

function present(req, doc) {
  return {
    code: doc.code,
    shortUrl: buildShortUrl(req, doc.code),
    longUrl: doc.longUrl,
    clicks: doc.clicks,
    createdAt: doc.createdAt,
  };
}

/**
 * Codes are random, so a collision is rare but not impossible. The unique
 * index is the real guard; retry on the duplicate-key error it raises.
 */
async function insertWithUniqueCode(longUrl) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await Url.create({ code: generateShortCode(config.shortCodeLength), longUrl });
    } catch (err) {
      if (err?.code !== 11000) throw err; // not a collision — a real failure
      console.warn(`[api] short code collision, retrying (${attempt}/5)`);
    }
  }
  throw new Error('Could not generate an unused short code after 5 attempts');
}

// ---------------------------------------------------------------- /api -----

export const apiRouter = Router();

apiRouter.use((req, res, next) => {
  if (!isDatabaseReady()) return res.status(503).json({ error: DB_DOWN_MESSAGE });
  next();
});

apiRouter.post(
  '/shorten',
  wrap(async (req, res) => {
    const longUrl = normalizeUrl(req.body?.url); // throws ValidationError -> 400

    // Same URL twice returns the same code instead of filling the collection.
    const existing = await Url.findOne({ longUrl });
    if (existing) return res.status(200).json(present(req, existing));

    const created = await insertWithUniqueCode(longUrl);
    res.status(201).json(present(req, created));
  }),
);

apiRouter.get(
  '/urls/:code',
  wrap(async (req, res) => {
    const doc = await Url.findOne({ code: req.params.code });
    if (!doc) return res.status(404).json({ error: 'No link exists with that code.' });
    res.json(present(req, doc));
  }),
);

// ------------------------------------------------------------ /:code -------

export const redirectRouter = Router();

redirectRouter.get(
  '/:code',
  wrap(async (req, res, next) => {
    const { code } = req.params;
    // Not code-shaped (e.g. /favicon.ico) — let the 404 handler deal with it.
    if (!SHORT_CODE_PATTERN.test(code)) return next();

    if (!isDatabaseReady()) return res.status(503).type('text').send(DB_DOWN_MESSAGE);

    // One atomic round trip: find the link and count the visit together.
    const doc = await Url.findOneAndUpdate({ code }, { $inc: { clicks: 1 } });
    if (!doc) return next();

    res.redirect(302, doc.longUrl);
  }),
);
