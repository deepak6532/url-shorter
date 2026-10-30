const form = document.querySelector('#shorten-form');
const input = document.querySelector('#url-input');
const submitButton = document.querySelector('#submit-button');
const errorBox = document.querySelector('#error');
const result = document.querySelector('#result');
const shortLink = document.querySelector('#short-link');
const longUrlText = document.querySelector('#long-url');
const clickCount = document.querySelector('#click-count');
const clickLabel = document.querySelector('#click-label');
const copyButton = document.querySelector('#copy-button');
const refreshButton = document.querySelector('#refresh-button');

let currentCode = null;

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  result.hidden = true;
  currentCode = null;
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = '';
}

function render(data) {
  clearError();
  currentCode = data.code;

  // textContent, never innerHTML — the URL is user input.
  shortLink.textContent = data.shortUrl;
  shortLink.href = data.shortUrl;
  longUrlText.textContent = `→ ${data.longUrl}`;
  setClicks(data.clicks);

  copyButton.textContent = 'Copy';
  result.hidden = false;
}

function setClicks(count) {
  clickCount.textContent = count;
  clickLabel.textContent = count === 1 ? 'click' : 'clicks';
}

/** Returns parsed JSON, or throws an Error carrying a message fit to display. */
async function requestJson(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error('Could not reach the server. Is it still running?');
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON response (a proxy error page, say) — fall through to the status.
  }

  if (!response.ok) {
    throw new Error(body?.error ?? `Request failed (HTTP ${response.status}).`);
  }
  return body;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = input.value.trim();
  if (!url) {
    showError('Please paste a URL first.');
    input.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Shortening…';

  try {
    render(
      await requestJson('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      }),
    );
  } catch (err) {
    showError(err.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Shorten';
  }
});

input.addEventListener('input', clearError);

copyButton.addEventListener('click', async () => {
  try {
    // navigator.clipboard is undefined on plain http:// outside localhost.
    if (!navigator.clipboard) throw new Error('unavailable');
    await navigator.clipboard.writeText(shortLink.textContent);
    copyButton.textContent = 'Copied';
  } catch {
    copyButton.textContent = 'Press Ctrl+C';
    const range = document.createRange();
    range.selectNodeContents(shortLink);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
  setTimeout(() => {
    copyButton.textContent = 'Copy';
  }, 1800);
});

refreshButton.addEventListener('click', async () => {
  if (!currentCode) return;

  refreshButton.disabled = true;
  try {
    const data = await requestJson(`/api/urls/${encodeURIComponent(currentCode)}`);
    setClicks(data.clicks);
  } catch (err) {
    showError(err.message);
  } finally {
    refreshButton.disabled = false;
  }
});
