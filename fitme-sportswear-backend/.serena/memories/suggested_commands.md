# Suggested Commands

Run from `fitme-sportswear-backend/` unless noted.

Install:
- `npm install`

Prisma:
- `npm run prisma:generate`
- `npm run prisma:migrate` for local dev migrations.
- `npm run prisma:deploy` for deploy migrations.

Dev/run:
- `npm run start:dev`
- `npm run worker:dev`
- `npm run start`
- `npm run worker`

Validation:
- `npm test`
- `npm test -- <spec-name>.spec.ts`
- `npm run build`
- `npm run lint`
- `npm run test:e2e` when e2e dependencies/env are available.

Local infra/health:
- `docker compose up -d postgres redis`
- `curl http://localhost:3000/health`
- `curl http://localhost:3000/health/readiness`

From parent repo, prefix backend commands with `npm --prefix fitme-sportswear-backend ...`.