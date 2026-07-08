# Uptime Monitor

A lightweight full-stack uptime monitor. Register URLs, and a background scheduler
pings each one every ~60 seconds, storing the HTTP status code, response time, and
timestamp of every check. A React dashboard polls the API and shows live up/down
status.

## Stack

- **Backend**: Node.js + Express, SQLite (`better-sqlite3`) for storage, `node-cron`
  for the periodic ping scheduler.
- **Frontend**: React + Vite, built and served as a static bundle via nginx.
- **Orchestration**: Docker Compose, two containers.

## 1-Line Setup

```bash
docker compose up --build
```

- Backend API: http://localhost:4000
- Frontend dashboard: http://localhost:5173

Data persists in a named Docker volume (`backend-data`), so restarting the stack
doesn't lose history.

## Testing Steps (verify up/down detection)

1. Run `docker compose up --build` and open http://localhost:5173.
2. Add a **healthy** URL: name `Example`, URL `https://example.com`. Click **Add URL**.
   - Within a few seconds it should show status **UP**, an HTTP code of `200`, and a
     response time in ms.
3. Add a **broken/unreachable** URL: name `Broken`, URL `https://this-domain-does-not-exist-12345.com`.
   - It should show status **DOWN** with no HTTP code (network/DNS failure) once its
     first check runs (near-instant, since adding a URL triggers an immediate check
     rather than waiting for the next minute).
4. You can also test a URL that resolves but returns an error, e.g.
   `https://httpstat.us/500`, to confirm non-2xx/3xx codes are correctly reported as
   **DOWN** with the actual status code shown (`500`).
5. Refresh or just watch the dashboard — it auto-polls every 5 seconds, and the
   backend re-checks all URLs every 60 seconds via `node-cron`.
46. To confirm data is actually being persisted per-check (not just "latest status"),
   hit `GET http://localhost:4000/api/urls/<id>/history` to see the last 50 checks
   for a given URL with timestamps.

## Known Limitations / Tradeoffs

- **Resource Usage (Puppeteer)**: The monitor executes real headless Chrome browsers using `puppeteer-extra-plugin-stealth` instead of lightweight HTTP requests. This allows it to successfully bypass advanced bot detection (like Cloudflare on `claude.ai` and `medium.com`) and return a realistic 200 OK, perfectly mimicking a real user. However, this comes at the cost of significantly higher CPU and RAM usage. For an MVP at a small scale, running Chrome is acceptable, but for thousands of URLs, we would need to scale the Chrome instances or fall back to standard HTTP requests.

## API

| Method | Path                     | Description                                  |
|--------|--------------------------|-----------------------------------------------|
| GET    | `/api/urls`              | List monitored URLs with latest status        |
| POST   | `/api/urls`               | Register a URL (`{ name?, url }`)             |
| DELETE | `/api/urls/:id`           | Stop monitoring a URL                         |
| GET    | `/api/urls/:id/history`   | Last 50 checks for a URL                      |
| GET    | `/api/health`             | Basic health check for the API itself         |

## Deployment Sketch (light)

For an MVP at this scale (a few dozen URLs, minute-level checks), I'd avoid
over-engineering and deploy both containers to a small managed container platform
rather than standing up Kubernetes. A reasonable AWS shape:

- **Backend**: single ECS Fargate service (1 task, 0.25 vCPU / 0.5GB is plenty),
  behind an Application Load Balancer. Swap SQLite for a small RDS Postgres instance
  once you need more than one backend replica (SQLite is single-writer, fine for
  one container, not for horizontal scaling).
- **Frontend**: build the static bundle and host it on S3 + CloudFront instead of
  running nginx in a container — cheaper and simpler at this scale.
- **Scheduler**: at this size, keeping the cron job inside the backend process (as
  implemented) is fine. If check volume grows a lot, split it into a separate
  EventBridge-scheduled Lambda or ECS scheduled task so ping load doesn't compete
  with API request handling.

Minimal hypothetical Terraform sketch (illustrative, not complete):

```hcl
resource "aws_ecs_service" "backend" {
  name            = "uptime-backend"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.backend.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name    = "backend"
    container_port    = 4000
  }
}

resource "aws_s3_bucket" "frontend" {
  bucket = "uptime-monitor-frontend"
}

resource "aws_cloudfront_distribution" "frontend" {
  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "frontend-s3"
  }
  default_cache_behavior {
    target_origin_id       = "frontend-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
  }
  enabled             = true
  default_root_object = "index.html"
  restrictions { geo_restriction { restriction_type = "none" } }
  viewer_certificate { cloudfront_default_certificate = true }
}
```

Not grading production hardening here, so I've skipped things like WAF, private
RDS subnet groups, secrets management, etc. — just sketching the topology.

## AI Collaboration

See [`AI_LOG.md`](./AI_LOG.md) for the AI tools used, the prompts that generated
the core layers, and a course-correction example.
