# Suggested Commands

Run from repo root with `--prefix fitme-sportswear-backend` unless already inside backend.

Install:
- `npm --prefix fitme-sportswear-backend install`

Prisma:
- `npm --prefix fitme-sportswear-backend run prisma:generate`
- `npm --prefix fitme-sportswear-backend run prisma:migrate` for local dev migrations.
- `npm --prefix fitme-sportswear-backend run prisma:deploy` for deploy migrations.

Dev/run:
- `npm --prefix fitme-sportswear-backend run start:dev`
- `npm --prefix fitme-sportswear-backend run worker:dev`
- `npm --prefix fitme-sportswear-backend run start`
- `npm --prefix fitme-sportswear-backend run worker`

Validation:
- `npm --prefix fitme-sportswear-backend test`
- `npm --prefix fitme-sportswear-backend test -- <spec-name>.spec.ts`
- `npm --prefix fitme-sportswear-backend run build`
- `npm --prefix fitme-sportswear-backend run lint`
- `npm --prefix fitme-sportswear-backend run test:e2e` if e2e deps/env are available.

Git safety:
- `git status --short -- sportswear-main` should be empty for backend-only tasks.