# Deployment Guide

## Staging Deployment (Local or VM)

This guide shows how to deploy the Keka-Slack middleware to a staging environment using Docker Compose.

### Prerequisites

- Docker & Docker Compose installed
- Slack App with valid `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET`
- Keka test credentials (`KEKA_API_BASE`, `KEKA_API_TOKEN`)
- A staging Slack workspace for interactive button testing

### 1. Prepare secrets

Create a `.env.prod` file (do not commit to repo):

```bash
cat > .env.prod << EOF
DB_PASSWORD=strong_password_here
DB_NAME=keka_staging
NODE_ENV=production
PORT=3000

# Slack
SLACK_SIGNING_SECRET=xoxp-slack-signing-secret-here
SLACK_BOT_TOKEN=xoxb-slack-bot-token-here
DEFAULT_FALLBACK_APPROVER_SLACK_ID=UXXXXXXXXX

# Keka
KEKA_API_BASE=https://test.keka.com/api/v1
KEKA_API_TOKEN=keka_test_token_here

# Short break policy
SHORT_BREAK_MAX_SINGLE_MIN=15
SHORT_BREAK_MAX_DAILY_MIN=30
LUNCH_BREAK_MAX_MINUTES=30
EOF
```

**Important:** Never commit `.env.prod` to the repo. Add it to `.gitignore` or use a secret manager.

### 2. Start staging services

```bash
docker compose -f docker-compose.prod.yml up --build -d --env-file .env.prod
```

This will:
- Build the app image
- Start Postgres with persistent storage
- Run DB migrations automatically
- Start the app on port 3000 (or your configured PORT)

### 3. Verify staging is up

```bash
docker compose -f docker-compose.prod.yml ps
```

Check logs:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

### 4. Seed test data (optional)

Run the seed script inside the app container:

```bash
docker compose -f docker-compose.prod.yml exec -T app npm run seed:dev
```

This creates a `daily_attendance_state` row for `UTEST01` with `first_login_approval_required = TRUE`.

### 5. Verify endpoints

Test health:

```bash
# From host machine
curl -s http://localhost:3000/health | jq .
# Expected: status=ok, db=connected, pendingApprovalsCount=<number>
```

Test metrics:

```bash
curl -s http://localhost:3000/metrics | head -n 40
```

### 6. Insert a test approval and approve via API

From the host:

```bash
# Insert a test approval
docker compose -f docker-compose.prod.yml exec -T db psql -U postgres -d keka_staging -c \
"INSERT INTO approvals (slack_user_id, date, request_type, reason, status, created_at, updated_at) 
VALUES ('UTEST_APPROVER', current_date, 'FIRST_LOGIN', 'Staging test', 'PENDING', NOW(), NOW()) RETURNING id;"

# Approve (requires a Slack-signed request; API calls must include valid Slack signature)
# For testing, if you bypass Slack verification, you can POST:
# curl -X POST http://localhost:3000/approvals/1/approve \
#   -H 'Content-Type: application/json' \
#   -d '{"approver_id":"U_APPROVER","notes":"Test approval"}' | jq .
```

**Note:** In production, the `/approvals/:id/approve` and `/approvals/:id/reject` endpoints require Slack signature verification via the `slackVerification` middleware. Only signed Slack requests (or interactive button actions from Slack) are allowed.

### 7. Test interactive Slack buttons (E2E)

1. Set up a Slack App with Request URL pointing to your staging server:
   - Use `https://<staging-url>/slack/slash` for slash commands
   - Use `https://<staging-url>/slack/actions` for interactive buttons

2. Have a user trigger `/keka login` in the staging Slack workspace.

3. Approver receives a DM with interactive **Approve** and **Reject** buttons.

4. Click a button and verify:
   - DB approval row updates (status = APPROVED or REJECTED)
   - Slack DMs sent to both the user and approver
   - If FIRST_LOGIN, `first_login_approval_required` flag cleared in `daily_attendance_state`

### 8. Monitor logs and metrics

Watch app logs in real-time:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

Watch DB logs:

```bash
docker compose -f docker-compose.prod.yml logs -f db
```

Scrape metrics (for Prometheus integration):

```bash
curl -s http://localhost:3000/metrics
```

Monitor `keka_punch_failures_total` counter for retry failures.

### 9. Tear down staging

```bash
docker compose -f docker-compose.prod.yml down -v
```

This removes containers and volumes (use `-v` carefully in production).

---

## Production Deployment (Advanced)

For production, consider:

1. **Docker Registry**: Push image to a private registry (GHCR, ECR, DockerHub).
2. **Orchestration**: Use Kubernetes, ECS, or similar for multi-instance deployment.
3. **Secrets Manager**: Use AWS Secrets Manager, HashiCorp Vault, or Kubernetes Secrets.
4. **TLS/HTTPS**: Use a reverse proxy (nginx, Cloudflare) with valid certificates.
5. **Monitoring**: Configure Prometheus scraping for `/metrics` endpoint and set up alerts.
6. **Backups**: Ensure DB snapshots and data persistence.
7. **Load Balancer**: Use if scaling horizontally.

### Quick staging on a VM using ngrok (temporary)

If you want a public staging URL quickly:

```bash
# On the VM with docker-compose running
docker compose -f docker-compose.prod.yml up -d

# On another terminal, install ngrok (https://ngrok.com/download)
ngrok http 3000

# ngrok will output a public URL like: https://abc123.ngrok.io
# Set Slack app Request URL to: https://abc123.ngrok.io/slack/slash
```

---

## Health Checks & Monitoring

The health endpoint now includes:

- `status`: "ok" (2xx) or "degraded" (5xx)
- `db`: "connected" or "error"
- `pendingApprovalsCount`: number of pending approvals

Example:

```json
{
  "status": "ok",
  "timestamp": "2025-11-15T12:00:00.000Z",
  "db": "connected",
  "pendingApprovalsCount": 3
}
```

Use this for health checks in load balancers and orchestration systems.

---

## Approval Endpoints (Auth Required)

Both endpoints now require Slack signature verification:

- `POST /approvals/:id/approve` — requires `slackVerification` middleware
- `POST /approvals/:id/reject` — requires `slackVerification` middleware

Request body:

```json
{
  "approver_id": "U_SLACK_USER_ID",
  "notes": "Optional approval notes"
}
```

Only requests signed by Slack (with valid `SLACK_SIGNING_SECRET`) are accepted. Returns `401 Unauthorized` if signature is invalid, `403 Forbidden` if approver_id is missing.

---

## Troubleshooting

### DB connection error

Check DATABASE_URL and ensure Postgres container is healthy:

```bash
docker compose -f docker-compose.prod.yml exec db pg_isready -U postgres
```

### Migrations failed

Check app logs for SQL errors:

```bash
docker compose -f docker-compose.prod.yml logs app | grep -i "migration\|error"
```

### Slack verification fails

Ensure `SLACK_SIGNING_SECRET` matches your Slack app's signing secret exactly (no leading/trailing spaces).

### Port already in use

Change PORT env var:

```bash
export PORT=8080
docker compose -f docker-compose.prod.yml up -d --env-file .env.prod
```

---

See `RUNBOOK.md` for local development with `docker-compose.dev.yml`.
