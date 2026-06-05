# Tech Stack

- TypeScript + NestJS 10.
- npm package manager.
- Node.js 22+ expected by README/types.
- Prisma Client/CLI 6.x with PostgreSQL datasource.
- BullMQ 5 + Redis/ioredis for background jobs.
- Joi for env validation in `src/modules/config/env.validation.ts`.
- Jest 29 + ts-jest; unit specs are colocated as `src/**/*.spec.ts` with Jest `rootDir: src`.
- ESLint 9 script covers `{src,test}/**/*.ts`.
- Docker Compose can run API, worker, Redis, PostgreSQL.
- Built API entrypoint: `node dist/main.js`; built worker entrypoint: `node dist/worker.js`.