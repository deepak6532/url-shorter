import { randomBytes } from 'node:crypto';

/** Thrown for anything the user can fix by typing something else. Maps to 400. */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

const MAX_URL_LENGTH = 2048;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// Accepts localhost, a bare IPv4, or a real dotted hostname. Deliberately
// stricter than `new URL()`, which happily parses "https://hello".
const VALID_HOSTNAME =
  /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})$/i;

/**
 * Validates user input and returns a canonical absolute URL string.
 * Throws ValidationError with a message meant to be shown to the user.
 */
export function normalizeUrl(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new ValidationError('Please paste a URL first.');
  }

  const trimmed = input.trim();
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new ValidationError(`That URL is too long (max ${MAX_URL_LENGTH} characters).`);
  }

  // Be forgiving about a missing scheme: "wedigtech.com" -> "https://wedigtech.com"
  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new ValidationError("That doesn't look like a valid URL.");
  }

  // Blocks javascript:, data:, file: — a stored `javascript:` link would
  // otherwise run in the visitor's browser on redirect.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ValidationError('Only http:// and https:// links can be shortened.');
  }

  if (!VALID_HOSTNAME.test(url.hostname)) {
    throw new ValidationError("That doesn't look like a valid URL.");
  }

  return url.toString();
}

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
// 256 % 62 === 8, so bytes 248-255 would make the first 8 characters slightly
// more likely. Discard them instead of accepting a skewed distribution.
const UNBIASED_CEILING = 256 - (256 % ALPHABET.length);

export function generateShortCode(length = 6) {
  let code = '';
  while (code.length < length) {
    for (const byte of randomBytes(length)) {
      if (byte >= UNBIASED_CEILING) continue;
      code += ALPHABET[byte % ALPHABET.length];
      if (code.length === length) break;
    }
  }
  return code;
}

/** Shape of a code in a URL path — used to tell `/a7Bz91` from `/favicon.ico`. */
export const SHORT_CODE_PATTERN = /^[0-9A-Za-z]{4,16}$/;
