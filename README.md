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
# kekapunches
keka punches middleware
