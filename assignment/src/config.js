import 'dotenv/config';

/**
 * Reads and validates every environment variable the app needs, once, at boot.
 * Failing here with a readable message beats failing later with a stack trace.
 */

function required(name, hint) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[config] Missing required environment variable ${name}.`);
    console.error(`[config] ${hint}`);
    process.exit(1);
  }
  return value;
}

function intInRange(name, fallback, min, max) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < min || value > max) {
    console.error(`[config] ${name} must be a number between ${min} and ${max}. Got: "${raw}"`);
    process.exit(1);
  }
  return value;
}

export const config = {
  mongoUri: required('MONGODB_URI', 'Copy .env.example to .env and set your MongoDB connection string.'),
  port: intInRange('PORT', 3000, 1, 65535),
  // Trailing slashes make for `https://host//abc123`, so strip them here once.
  baseUrl: (process.env.BASE_URL ?? '').trim().replace(/\/+$/, ''),
  shortCodeLength: intInRange('SHORT_CODE_LENGTH', 6, 4, 16),
};
