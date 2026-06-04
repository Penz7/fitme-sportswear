# Task Completion

- If touching `fitme-sportswear-backend` TypeScript code, run from that module: `npm run lint`, `npm test`, and `npm run build`. Add `npm run test:e2e` when API/integration behavior changes.
- If touching backend Prisma schema or migrations, run `npm run prisma:generate`; run the appropriate migration command only with the intended database target confirmed.
- If touching `sportswear-main` Java/Spring code, run from that module: `./mvnw test` when wrapper is available, otherwise `mvn test`; use `./mvnw package`/`mvn package` for broader build validation.
- If changing runtime integration behavior, verify required env/profile settings before running app-level checks because configs reference external APIs and credentials.
- Do not treat generated directories (`target/`, `dist/`, generated Prisma client) as source changes unless the task explicitly requires generated artifacts.