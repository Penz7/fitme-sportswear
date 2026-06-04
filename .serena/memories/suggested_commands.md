# Suggested Commands

- Backend (`fitme-sportswear-backend`):
  - `npm run build` — Nest build.
  - `npm run start:dev` — start Nest API in watch mode.
  - `npm run worker:dev` — start BullMQ worker via ts-node.
  - `npm run lint` — lint `src` and `test` TypeScript files.
  - `npm test` — Jest unit specs under `src`.
  - `npm run test:e2e` — e2e Jest config under `test/`.
  - `npm run prisma:generate`, `npm run prisma:migrate`, `npm run prisma:deploy` — Prisma client/migration flows.
  - `docker compose up -d` from backend dir for local services when needed.
- Spring app (`sportswear-main`):
  - `./mvnw spring-boot:run` or `mvn spring-boot:run` from module dir.
  - `./mvnw test` or `mvn test` from module dir.
  - `./mvnw package` or `mvn package` from module dir.
  - `docker compose -f docker-compose.dev.yml up -d` for dev compose stack; prod compose file also exists.
- Darwin shell is zsh; use quoted paths for names with spaces if introduced.