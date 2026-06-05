# Task Completion

Before claiming backend implementation is done:
- Run the narrow relevant Jest spec first: `npm test -- <spec-name>.spec.ts`.
- For broader/shared changes, run `npm test`.
- Run `npm run build` for TypeScript/Nest compilation confidence.
- Run `npm run lint` when code style or imports changed.
- If Prisma schema changed, run `npm run prisma:generate` and the relevant migration/deploy command.
- For webhook, sync, queue, or integration-client changes, verify associated unit specs and consider adding focused tests for idempotency/error handling.

If working from the parent repo, use `npm --prefix fitme-sportswear-backend ...`.