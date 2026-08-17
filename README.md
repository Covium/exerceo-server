# Exerceo server

NestJS API for the Exerceo exercise tracker. This repository is independent of `exerceo-client`.

## Requirements

- Node.js 22+
- Docker (for PostgreSQL) or a local PostgreSQL 16 instance

## Setup

```powershell
Copy-Item .env.example .env
docker compose up -d
npm install
npm install-scripts approve prisma
npm install-scripts approve @prisma/client
npm install-scripts approve @prisma/engines
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

The API listens on [http://localhost:3000](http://localhost:3000).

## Authentication

`POST /auth/enter` creates an account when the login does not exist, or signs in when it does. Passwords are hashed with bcrypt and never stored in plaintext. Clients send `Authorization: Bearer <token>`.

## Weekly goals and streaks

- Each user sets a weekly qualifying-workout target (for example 4 per week).
- A calendar day counts at most once, even if both a manual `Exerceo!` mark and Health Connect sessions exist for that day.
- The primary streak is consecutive ISO weeks (Monday–Sunday) in which the weekly target was met.
- Synchronization of Health Connect summaries is idempotent.

## Privacy

The API stores only what Exerceo needs: accounts, groups, goals, manual workouts, measurements, and daily summaries. There is no advertising, analytics, or third-party tracking.
