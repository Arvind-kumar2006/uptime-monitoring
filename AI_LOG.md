# AI Collaboration Log

## AI Tech Stack

- **Assistant**: Claude (Anthropic), used directly in the Claude chat interface.
- **Role**: Generated the backend API, scheduler, frontend dashboard, Dockerfiles,
  docker-compose orchestration, and this documentation, based on the assignment
  brief pasted directly into the conversation.

## The Prompts That Shipped It

1. **Kickoff** — I pasted the full assignment brief and said:
   > "today i got opportunity from somewhere so let's discuss how we can build this
   > own monitoring system"

   Claude responded with a proposed architecture (Node/Express + SQLite backend,
   React/Vite frontend, Docker Compose) and asked a clarifying question about my
   preferred backend language/frontend framework before generating anything, rather
   than assuming a stack.

2. **Stack confirmation** — I picked Node.js + Express for the backend and React
   (Vite) for the frontend.

3. **Core generation** — With the stack confirmed, Claude generated, file by file:
   - `backend/db.js`: SQLite schema (`urls` + `checks` tables, one-to-many).
   - `backend/scheduler.js`: a `node-cron` job pinging all registered URLs every
     60s, using `AbortController` to enforce a request timeout and catching
     network errors as "down" rather than letting them crash the process.
   - `backend/server.js`: REST endpoints (`GET/POST /api/urls`,
     `GET /api/urls/:id/history`, `DELETE /api/urls/:id`), including URL
     validation and an immediate check triggered on registration (so the UI
     isn't stuck showing "pending" for up to a minute after adding a URL).
   - `frontend/src/App.jsx`: a polling dashboard (5s interval) with a form to add
     URLs and a table showing status badges, HTTP code, response time, and last
     check time.
   - `docker-compose.yml` and two Dockerfiles (backend: Node + native build tools
     for `better-sqlite3`; frontend: multi-stage build served by nginx).

## Course Corrections

**The bad default: browser calling an internal Docker hostname.**

When first reasoning about how the frontend would reach the backend inside Docker
Compose, the natural-looking (but wrong) assumption is that since both containers
are on the same Compose network, the frontend can just call
`http://backend:4000/api/urls` — after all, that's exactly how you'd address it
from *within* another container.

That's broken for a browser-based frontend: the React code doesn't run inside the
frontend container, it runs in the *user's browser* on their host machine, which
has no knowledge of the Docker Compose internal DNS network. `http://backend:4000`
would resolve to nothing outside the Compose network and every API call would fail
silently with a network error.

**The fix**: the frontend must call the backend via its **host-mapped port**
(`http://localhost:4000`), not the internal service name. This is baked in as a
Vite build-time environment variable (`VITE_API_URL`), passed as a Docker build
arg in `docker-compose.yml`, so it's easy to change if the deployment target
changes (e.g., pointing at a real backend domain in production instead of
`localhost`). Only server-to-server calls (if any existed here) would use the
Compose service name; anything the browser calls directly has to use an
externally-reachable address.

This is called out explicitly in code comments in `App.jsx` and
`docker-compose.yml` so it doesn't get "fixed" back to the internal hostname by a
future contributor (human or AI) who pattern-matches to the more common
container-to-container case.

**Found by actually running it: false "DOWN" from bot detection, not real downtime.**

After spinning the stack up locally and adding a handful of real-world URLs
(`claude.ai`, `medium.com`, `youtube.com`, `mail.google.com`), two clearly-live
sites (`claude.ai`, `medium.com`) showed as **DOWN** with a `403` status code.
The initial `pingUrl` implementation sent a bare `fetch(url)` with no headers at
all — some sites' bot/scraper protection returns `403` to requests that don't
look like a real browser (no `User-Agent`, no `Accept` header), which the
monitor was then correctly-but-misleadingly reporting as "down."

**The fix**: added a realistic browser `User-Agent` and `Accept` header to every
outbound check (`REQUEST_HEADERS` in `scheduler.js`). This is a judgment call
worth stating explicitly rather than hiding: the monitor is now checking "is this
reachable by something that looks like a normal browser request," not "is this
reachable by literally anything." A stricter/more honest monitor could instead
surface *both* signals (raw fetch vs. browser-like fetch) so a 403-only-to-bots
site doesn't get silently masked — that's a reasonable v2 feature, called out
here rather than quietly designed around.
