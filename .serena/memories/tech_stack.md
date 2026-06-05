# Tech Stack

Backend:
- TypeScript + NestJS 10.
- Prisma Client/CLI 6.x, PostgreSQL datasource.
- BullMQ 5 + Redis/ioredis for background work.
- Joi for env validation via `src/modules/config/env.validation.ts`.
- Jest + ts-jest for unit tests under `src/**/*.spec.ts` with Jest rootDir `src`.
- ESLint script covers `{src,test}/**/*.ts`.

Runtime layout:
- API entrypoint: `src/main.ts`, built start: `node dist/main.js`.
- Worker entrypoint: `src/worker.ts`, built worker: `node dist/worker.js`.
- Docker Compose includes API, worker, Redis, PostgreSQL.

Package manager: npm. Node requirement in README is Node 22+; package install may warn if Node is below supported patch level.