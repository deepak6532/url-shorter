# AI usage log

Tool used throughout: **Claude (Claude Code in the terminal)**, as a pair-programming
loop — ask, read what came back, run it, push back where it was wrong.

Entries are roughly in the order they happened. Where I overrode a suggestion, I said so
and why.

---

**Tool:** Claude
**Asked:** "Here's the assignment PDF. Pick a stack for a 2–3 hour URL shortener — React
+ Express + Mongo, or Next.js full-stack?"
**Got:** Suggested React + Vite + Express + MongoDB, with the frontend on its own dev
server.
**What I did:** Overrode it. The brief calls out over-engineering as a red flag and the
whole UI is one input and one button — a Vite build step and a second origin would only
buy me a CORS bug to debug. Served the static page from the same Express app instead.
Three dependencies total.

---

**Tool:** Claude
**Asked:** "Give me a regex to validate a URL before storing it."
**Got:** A long regex covering scheme, host, port, path and query.
**What I did:** Didn't use it. Regex URL validation is famously wrong at the edges and I
would not be able to debug that one in an interview. Used the built-in WHATWG parser
(`new URL()`) instead — it is in Node's stdlib and it is the same parser browsers use.

---

**Tool:** Claude
**Asked:** "Does `new URL()` alone reject bad input like `hello`?"
**Got:** "Yes, it throws on invalid input."
**What I did:** Tested it before trusting it, and it was wrong —
`new URL("https://hello")` parses fine, because the WHATWG spec does not require a dot
in a hostname. Since I auto-prefix `https://` when the scheme is missing, `hello` would
have sailed through. This is exactly the "paste hello and it crashes" case the brief
warns about, so I added a hostname check on top of the parser
(`VALID_HOSTNAME` in `src/url-utils.js`) and a test for it.

---

**Tool:** Claude
**Asked:** "Short code generator, 6 characters, base62."
**Got:** `randomBytes(6)`, then `ALPHABET[byte % 62]` per byte.
**What I did:** Used the shape, fixed the maths. `256 % 62 === 8`, so bytes 248–255 make
the first 8 characters of the alphabet slightly more likely. Added rejection sampling —
discard any byte ≥ 248 and draw again. Barely more code, and it is one less thing that is
quietly wrong.

---

**Tool:** Claude
**Asked:** "Mongoose schema for the link document."
**Got:** `code: { type: String, required: true, unique: true, index: true }`.
**What I did:** Dropped the `index: true`. `unique: true` already builds the index, and
having both makes Mongoose 8 print a "Duplicate schema index" warning on every boot. A
warning in the console on `npm start` is the kind of thing a reviewer notices.

---

**Tool:** Claude
**Asked:** "Why does my POST hang instead of returning 400 when validation throws?"
**Got:** Explained that Express 4 does not catch rejected promises from async handlers —
the request just hangs until it times out — and suggested either upgrading to Express 5
or wrapping handlers.
**What I did:** Stayed on Express 4 (better documented, and every answer I'd find while
debugging matches it) and added the four-line `wrap()` helper in `src/routes.js` so every
async handler forwards rejections to `next()`. Confirmed with
`curl -d '{"url":"hello"}'` that it now returns 400 immediately.

---

**Tool:** Claude
**Asked:** "Anything unsafe about storing whatever URL the user submits and redirecting
to it later?"
**Got:** Flagged that a stored `javascript:` URL would execute in the visitor's browser
when the redirect happens, and suggested allowlisting schemes.
**What I did:** Took it — this was the one thing I would not have thought of. Only
`http:` and `https:` are accepted, and `javascript:`, `data:` and `file:` have their own
test case.

---

**Tool:** Claude
**Asked:** "Mongo is up when the server boots but what if it dies while running?"
**Got:** Pointed out Mongoose buffers commands for ~10s and then throws a timeout, so the
user sees a long hang and then a 500.
**What I did:** Added a `readyState` check in front of the API router and the redirect
route, returning 503 with "check MONGODB_URI and that your MongoDB server is running".
Fails in well under a second with a message that says what to fix.

---

**Tool:** Claude
**Asked:** "Should shortening the same URL twice create two codes?"
**Got:** Said it depends — per-user shorteners usually dedupe, analytics-driven ones
don't.
**What I did:** Deduped, because for this app two codes for one URL is just a bigger
collection. Added the index on `longUrl` that the lookup needs. Noted in the README that
this is a deliberate choice, not an accident.

---

**Tool:** Claude
**Asked:** "`npm test` fails with `Cannot find module 'E:\assignment\test'`."
**Got:** Pointed out `node --test test/` resolves the bare path as a module on Windows,
and that Node 20+ discovers `**/*.test.js` on its own.
**What I did:** Changed the script to plain `node --test`. Small, but the README promises
anyone can clone and run this, and that includes on Windows.

---

**Tool:** Claude
**Asked:** Nothing — I hit this myself. Restarting the server before the old one had
exited printed a twenty-line `EADDRINUSE` stack trace. Asked Claude why my `start()`
error handler hadn't caught it.
**Got:** `server.listen()` reports failures by emitting an `error` event, not by
rejecting, so the `.catch()` on `start()` never runs.
**What I did:** Added a `server.on('error')` handler that turns `EADDRINUSE` into "Port
3000 is already in use. Stop the process using it, or set a different PORT in .env." and
rethrows anything else. Found only because I restarted the server during testing, which
is the argument for actually running the thing rather than reading it.

---

## Honest summary

AI wrote most of the first draft of every file here. What I actually spent my time on was
the three places it was wrong — the `hello` case, the modulo bias, and the Express 4 async
hang — plus deciding what *not* to build. I read every line before it went in; the one
suggestion I took wholesale without hesitation was the `javascript:` scheme warning,
because it was a real vulnerability I had not considered.
