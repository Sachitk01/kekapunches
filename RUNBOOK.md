# Local Dev Runbook — Smoke Tests (Docker Compose)

This runbook shows how to run a repeatable local smoke test environment with Postgres + the app. The compose file `docker-compose.dev.yml` runs migrations automatically before starting the app.

1) Copy the example env file and set any secrets:

```bash
cp .env.example .env
# Edit .env to set SLACK_SIGNING_SECRET, KEKA_API_TOKEN, etc.
```

2) Start services (builds image and runs migrations automatically):

```bash
docker-compose -f docker-compose.dev.yml up --build -d
```

3) Verify services are healthy and the app is running:

```bash
docker-compose -f docker-compose.dev.yml ps
curl -sS http://localhost:3000/health | jq .
curl -sS http://localhost:3000/metrics | head -n 40
```

4) Seed a `daily_attendance_state` row (inside the Postgres container). The app files are placed at `/usr/src/app` in the container image, so the seed file will be available there.

```bash
# Run the seed SQL using docker-compose exec (service name is 'db')
docker-compose -f docker-compose.dev.yml exec -T db psql -U postgres -d keka_dev -f /usr/src/app/db/seeds/seed_daily_attendance_state.sql
```

5) Create and approve a test approval (example):

```bash
docker-compose -f docker-compose.dev.yml exec -T db psql -U postgres -d keka_dev -c "INSERT INTO approvals (slack_user_id, date, request_type, reason, status, created_at, updated_at) VALUES ('UTEST01', current_date, 'FIRST_LOGIN', 'Test', 'PENDING', NOW(), NOW()) RETURNING id;"
curl -sS http://localhost:3000/approvals/pending | jq .
curl -sS -X POST http://localhost:3000/approvals/1/approve -H 'Content-Type: application/json' -d '{"approver_id":"U_APPROVER","notes":"OK"}' | jq .
```

6) Tear down the environment when finished:

```bash
docker-compose -f docker-compose.dev.yml down -v
```

Notes:
- `docker-compose.dev.yml` uses DB name `keka_dev` and creates a `db` service.  
- The compose `app` service runs `node scripts/runMigrationsPg.js` before starting the server.

### Seed via npm (cross-platform)

You can run the seed script from the repo root (uses `DATABASE_URL` or the app's env):

```bash
# Using your local env (example)
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/keka_dev"
npm run seed:dev
```

When running inside Docker Compose the DB is available at host `db` and the container's `DATABASE_URL` is set. If you prefer to run the seed inside the Postgres container, use the earlier `docker exec` commands shown above.

