# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=20-bookworm-slim

FROM node:${NODE_VERSION} AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    make \
    g++ \
    openssl \
  && rm -rf /var/lib/apt/lists/*
ENV PATH="/app/node_modules/.bin:${PATH}"

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci

FROM deps AS development
COPY . .
CMD ["npm", "-w", "apps/api", "run", "start:dev"]

FROM deps AS build
COPY . .
RUN npm -w apps/api run build \
  && npm prune --omit=dev --workspaces

FROM node:${NODE_VERSION} AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
EXPOSE 8090
CMD ["node", "apps/api/dist/main"]
