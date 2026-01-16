# QueshTech Monorepo

This repository is a monorepo containing:

- `apps/api` – NestJS + TypeORM API (Postgres + Redis)
- `apps/web` – Vite + React frontend

## Getting Started

### Install

```bash
npm install
```

### Run (dev)

- Run both API + Web:

```bash
npm run dev
```

- Run API only:

```bash
npm run dev:api
```

- Run Web only:

```bash
npm run dev:web
```

## Docker

The provided `docker-compose.yml` starts Postgres + Redis + pgAdmin + RedisInsight (and can also run the API container).

```bash
docker compose up --build
```

Helpful local URLs (defaults):

- Postgres: `localhost:5432` (user: `postgres`, password: `postgres`, db: `nestjs_typeorm_postgres_db`)
- pgAdmin: http://localhost:5050 (email: `admin@example.com`, password: `admin`) — override via `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD`
- Redis: `localhost:6379`
- RedisInsight: http://localhost:5540

## App docs

- API docs: see `apps/api/README.md`
- Web docs: see `apps/web/README.md`
