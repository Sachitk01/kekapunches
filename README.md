# Keka Slack Middleware (full implementation)

This repository implements a Slack ↔ Keka attendance middleware.

Setup quick steps

1. Install dependencies

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in secrets (do not commit `.env`)

```bash
cp .env.example .env
# edit .env with real secrets
```

3. Run DB migrations (requires `psql` and `DATABASE_URL` in .env)

```bash
npm run migrate
```

4. Start server

```bash
npm start
```

Security note: rotate secrets, do not commit `.env`.

Local development with Docker Compose

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to `postgres://postgres:postgres@localhost:5432/keka_dev` or let `docker-compose` use the default.

2. Start services:

```bash
docker compose up --build
```

3. Apply migrations (if not applied automatically):

```bash
docker compose exec app npm run migrate:pg
```

Running DB-backed integration tests locally

1. Ensure Postgres is running (via Docker Compose)
2. Set `DATABASE_URL` in your shell or `.env` to point to the DB
3. Run:

```bash
npm run migrate:pg
npm test -- --grep "DB integration"
```

# kekapunches
keka punches middleware
