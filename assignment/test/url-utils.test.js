import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  generateShortCode,
  normalizeUrl,
  SHORT_CODE_PATTERN,
  ValidationError,
} from '../src/url-utils.js';

/** Asserts that `input` is rejected, not silently accepted. */
function rejects(input) {
  assert.throws(() => normalizeUrl(input), ValidationError, `expected rejection: ${input}`);
}

describe('normalizeUrl', () => {
  it('accepts a normal https URL unchanged', () => {
    assert.equal(normalizeUrl('https://wedigtech.com/careers'), 'https://wedigtech.com/careers');
  });

  it('trims surrounding whitespace', () => {
    assert.equal(normalizeUrl('  https://example.com/  '), 'https://example.com/');
  });

  it('adds https:// when the scheme is missing', () => {
    assert.equal(normalizeUrl('example.com'), 'https://example.com/');
  });

  it('keeps the query string and fragment', () => {
    const url = 'https://example.com/search?q=url+shortener#results';
    assert.equal(normalizeUrl(url), url);
  });

  it('rejects empty and whitespace-only input', () => {
    rejects('');
    rejects('   ');
    rejects(undefined);
    rejects(null);
    rejects(42);
  });

  it('rejects plain words — the "hello" case', () => {
    rejects('hello');
    rejects('not a url');
  });

  it('rejects non-http schemes, including javascript:', () => {
    rejects('javascript:alert(1)');
    rejects('data:text/html,<script>alert(1)</script>');
    rejects('ftp://files.example.com');
    rejects('file:///etc/passwd');
  });

  it('rejects URLs longer than 2048 characters', () => {
    rejects(`https://example.com/${'a'.repeat(2048)}`);
  });

  it('allows localhost and bare IPv4 hosts', () => {
    assert.equal(normalizeUrl('http://localhost:3000/x'), 'http://localhost:3000/x');
    assert.equal(normalizeUrl('http://127.0.0.1:8080/'), 'http://127.0.0.1:8080/');
  });
});

describe('generateShortCode', () => {
  it('produces a code of the requested length, matching the route pattern', () => {
    for (const length of [4, 6, 10, 16]) {
      const code = generateShortCode(length);
      assert.equal(code.length, length);
      assert.match(code, SHORT_CODE_PATTERN);
    }
  });

  it('does not repeat itself across 5000 draws', () => {
    const codes = new Set();
    for (let i = 0; i < 5000; i += 1) codes.add(generateShortCode(6));
    assert.equal(codes.size, 5000);
  });
});
