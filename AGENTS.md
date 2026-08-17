# Exerceo server (`exerceo-server`)

This repository is the Exerceo **server**: the NestJS HTTP API and PostgreSQL schema.

The Vue/Android client lives in the sibling repository `exerceo-client`. Do not put frontend or Android code here.

Keep this repository focused on accounts, groups, goals, workouts, measurements, and daily activity summaries.

Do not copy raw Health Connect databases here. Prefer idempotent application-level summaries.

## Stack

- NestJS
- PostgreSQL
- Prisma
- JWT authentication
- bcrypt password hashing

## Conventions

- LF line endings, 2-space indentation
- TypeScript strict mode; do not use `any` except for imported library types
- Keep the API small. Do not introduce Redis, queues, microservices, or CQRS
- Dates from clients are calendar dates (`YYYY-MM-DD`) in the user's local timezone
- ISO weeks start on Monday
- A calendar day contributes at most one qualifying workout toward the weekly goal
- Health Connect sync must be idempotent (`userId + source + externalId`)

## Layout

```text
src/
  auth/           # register-or-login, JWT
  users/          # profile and weekly goal
  groups/         # membership and invitations
  workouts/       # manual workouts
  activity/       # daily summaries, sync, streaks
  measurements/   # body measurements
  prisma/         # Prisma client module
```

## Local development

```powershell
docker compose up -d
npm install
npx prisma migrate dev
npm run start:dev
```

The API listens on `http://localhost:3000`.

Production Compose is `docker-compose.prod.yml`. CI is `workflow_dispatch` only (Actions → Docker); it does not build or deploy on push.
