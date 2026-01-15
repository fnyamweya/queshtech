# QTech Monorepo

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

The provided `docker-compose.yml` starts Postgres + Redis + the API.

```bash
docker compose up --build
```

## App docs

- API docs: see `apps/api/README.md`
- Web docs: see `apps/web/README.md`
