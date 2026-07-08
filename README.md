# Uptime Monitor

A lightweight full-stack uptime monitoring application that periodically checks registered URLs and displays their status on a real-time dashboard.

## Tech Stack

- **Backend:** Node.js, Express, SQLite (`better-sqlite3`), `node-cron`
- **Frontend:** React + Vite
- **Real-time:** Socket.io
- **Browser Automation:** Puppeteer + Stealth Plugin
- **Containerization:** Docker & Docker Compose

---

## Quick Start

```bash
docker compose up --build
```

Open:

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:4000

Application data is stored in a Docker volume (`backend-data`), so it persists across container restarts.

---

## Features

- Add and remove monitored URLs
- Automatic health checks every 60 seconds
- Immediate health check when a URL is added
- Real-time dashboard updates using Socket.io
- Response time and HTTP status tracking
- Historical check records
- Dockerized setup

---

## Testing

1. Start the application.

```bash
docker compose up --build
```

2. Add a healthy URL.

```
https://example.com
```

Expected:

- Status: **UP**
- HTTP 200
- Response time displayed

3. Add an invalid URL.

```
https://this-domain-does-not-exist-12345.com
```

Expected:

- Status: **DOWN**

4. Add a URL returning an error.

```
https://httpstat.us/500
```

Expected:

- Status: **DOWN**
- HTTP Status: **500**

---

## API

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/urls` | List monitored URLs |
| POST | `/api/urls` | Add a new URL |
| DELETE | `/api/urls/:id` | Delete a monitored URL |
| GET | `/api/urls/:id/history` | Last 50 health checks |
| GET | `/api/health` | Health check |

---

## Limitations

- Uses **Puppeteer Stealth** instead of simple HTTP requests to handle websites protected by bot detection (e.g. Cloudflare).
- This improves accuracy but consumes significantly more CPU and memory than lightweight HTTP requests.
- For larger deployments, browser workers should be separated from the API service or replaced with a distributed monitoring architecture.

---

## Deployment

For a small-scale deployment:

- Backend → ECS/Fargate (or any container platform)
- Frontend → Static hosting (S3 + CloudFront, Vercel, or Netlify)
- Database → PostgreSQL when horizontal scaling is required

---

## AI Collaboration

See [AI_LOG.md](./AI_LOG.md)