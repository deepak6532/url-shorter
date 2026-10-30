# Shortly — a mini URL shortener

Paste a long URL, get a short one back. Visiting the short link 302-redirects to the
original and counts the visit.

Built for the WedigTech Full Stack Developer take-home.

---

## Stack, and why

| Layer    | Choice                        | One-line reason                                                                   |
| -------- | ----------------------------- | --------------------------------------------------------------------------------- |
| Backend  | Node + Express 4              | Fastest thing I can get a POST and a redirect out of, and I know its error model. |
| Database | MongoDB + Mongoose            | One connection string in `.env`, and the schema here is literally one document.    |
| Frontend | Plain HTML/CSS/JS, served by the same Express app | One input and one button does not need a build step, and it removes CORS entirely. |

The brief lists "way over-engineering" as a red flag, so this is one process, one port,
three dependencies (`express`, `mongoose`, `dotenv`), and no bundler.

No starter template or boilerplate generator was used — the files here were written for
this assignment.

---

## Run it in 5 minutes

**Prerequisites:** Node 18.17+ and a MongoDB you can reach — either a local `mongod` on
`27017` or a free MongoDB Atlas cluster.

```bash
git clone <this-repo-url>
cd <repo-folder>
npm install
```

Create your `.env` from the example:

```bash
cp .env.example .env          # Windows PowerShell: copy .env.example .env
```

Open `.env` and set `MONGODB_URI`:

```ini
# Local MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/urlshortener

# …or MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/urlshortener?retryWrites=true&w=majority
```

> If your Atlas password contains `@ : / ? # [ ] %`, percent-encode it, or the driver
> will read it as part of the host.

Start it:

```bash
npm start
```

Open <http://localhost:3000>. No database setup is needed beyond the URI — the
collection and its indexes are created on first write.

Run the tests:

```bash
npm test
```

### Environment variables

| Variable            | Required | Default | What it does                                                                  |
| ------------------- | -------- | ------- | ----------------------------------------------------------------------------- |
| `MONGODB_URI`       | **yes**  | —       | MongoDB connection string.                                                    |
| `PORT`              | no       | `3000`  | HTTP port.                                                                    |
| `BASE_URL`          | no       | derived from the request | Origin used to build the returned short link. Set it if you deploy behind a proxy. |
| `SHORT_CODE_LENGTH` | no       | `6`     | Characters in a generated code (4–16).                                        |

All of them are validated at boot — a missing `MONGODB_URI` or a `PORT=abc` exits
immediately with a message saying what to fix, rather than failing halfway through a
request.

---

## API

| Method | Path              | Body              | Response                                                                 |
| ------ | ----------------- | ----------------- | ------------------------------------------------------------------------ |
| `POST` | `/api/shorten`    | `{ "url": "…" }`  | `201` with `{ code, shortUrl, longUrl, clicks, createdAt }`. `200` with the same body if that URL was already shortened. |
| `GET`  | `/api/urls/:code` | —                 | `200` with the same shape, for reading the click count. `404` if unknown. |
| `GET`  | `/:code`          | —                 | `302` to the original URL, and `clicks` is incremented.                   |

```bash
curl -X POST http://localhost:3000/api/shorten \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://wedigtech.com/careers"}'
# {"code":"Re2A37","shortUrl":"http://localhost:3000/Re2A37", … ,"clicks":0}

curl -i http://localhost:3000/Re2A37
# HTTP/1.1 302 Found
# Location: https://wedigtech.com/careers
```

### Data model

One document per link:

```js
{ code: "Re2A37", longUrl: "https://wedigtech.com/careers", clicks: 2, createdAt, updatedAt }
```

`code` is unique-indexed; `longUrl` is indexed because every create looks it up first to
return the existing code instead of minting a duplicate.

---

## What's working

- Shorten a URL from the page, see the short link, copy it.
- `/:code` redirects with a real `302`.
- Mappings persist in MongoDB — restarting the server loses nothing.
- **Nice-to-have implemented (one, as instructed): a click counter.** Each redirect
  atomically `$inc`s `clicks`; the page shows the count with a Refresh button.
- Shortening the same URL twice returns the same code rather than a second row.
- `npm test` — 11 unit tests over URL validation and code generation.

## Edge cases I actually tested

Each of these was hit with `curl` and through the UI:

| Input / situation                      | Result                                                       |
| -------------------------------------- | ------------------------------------------------------------ |
| Empty or whitespace-only input          | `400` "Please paste a URL first."                            |
| `hello` (the brief's example)           | `400` "That doesn't look like a valid URL." — no crash       |
| `javascript:alert(1)`, `data:…`, `ftp://…` | `400` only `http`/`https` allowed. A stored `javascript:` link would run in the visitor's browser on redirect. |
| `example.com` with no scheme            | Accepted, normalised to `https://example.com/`               |
| URL longer than 2048 characters         | `400` with the limit stated                                  |
| Request body that isn't valid JSON      | `400` "Request body must be valid JSON."                     |
| Request body over 10 kB                 | `413`                                                        |
| `GET /zzzzzz` (unknown code)            | `404` HTML page with a link back                             |
| `GET /api/urls/zzzzzz`                  | `404` JSON                                                   |
| `GET /favicon.ico` (not code-shaped)    | Falls through to `404`, never hits the database              |
| `MONGODB_URI` missing / `PORT=abc`      | Exits at boot with the specific variable named               |
| MongoDB unreachable at startup          | Exits with "Is MONGODB_URI in .env correct, and is MongoDB reachable?" |
| Port already in use                     | Exits with "Port 3000 is already in use. …set a different PORT in .env." |
| MongoDB dies while running              | `503` with a readable message instead of a 10s driver timeout |
| Short code collision                    | Retried up to 5 times against the unique index               |

## What's not there

- **No user accounts, auth, or rate limiting.** A public shortener would need the last
  one; it is out of scope for this exercise.
- **No custom short codes and no "last 5 links" list.** The brief says pick at most one
  nice-to-have, so only the click counter is in.
- **No link expiry or deletion.**
- **No integration tests against a real MongoDB.** The unit tests cover validation and
  code generation; the HTTP layer was verified by hand with `curl` (table above).
- **Not deployed.** It runs locally, which the brief says is enough.

---

## What I'd do next with another 4 hours

1. **Integration tests.** Spin up `mongodb-memory-server` and test the three routes for
   real — create, duplicate-create, redirect-and-count, 404. Right now that table above
   is me and `curl`, which doesn't survive a refactor.
2. **Rate limiting on `POST /api/shorten`.** The one thing genuinely missing before this
   could face the internet; `express-rate-limit` keyed by IP, plus a per-IP daily cap.
3. **Real click analytics instead of a counter.** Write a `clicks` collection with
   timestamp and referrer per visit, so the number can become "when and from where".
   The `$inc` counter is fine for a demo and useless for a decision.
4. **Custom short codes.** The route already validates code shape; it needs a reserved-
   word list (`api`, `admin`, `static`) and a clear 409 when a code is taken.
5. **Structured logging.** `console.log` is fine for one process on a laptop and wrong
   anywhere else — `pino` with a request id, so a 500 can be traced to a request.

## What was harder than expected

Getting URL validation to reject `hello`. `new URL("https://hello")` parses perfectly
happily — the WHATWG parser does not require a dot in the hostname — so the obvious
"just use the built-in parser" answer silently accepted garbage. The fix was to keep the
parser for structure and add a hostname check on top of it. See `src/url-utils.js`.

## Project layout

```
server.js              Express app, middleware order, 404 + error handlers, startup/shutdown
src/config.js          Reads and validates every env var once, at boot
src/db.js              Mongoose connection, readiness check, credential-safe logging
src/url.model.js       The one schema
src/url-utils.js       URL validation + short-code generation (no Express, no Mongo — testable)
src/routes.js          /api/shorten, /api/urls/:code, and the /:code redirect
public/                index.html, styles.css, app.js, 404.html
test/url-utils.test.js 11 tests, node:test — no framework
```

An honest breakdown of AI assistance is documented in [AI_DOCUMENTATION.md](./AI_DOCUMENTATION.md) (with raw prompt logs in [AI_LOG.md](./AI_LOG.md)).
