# Task Completion

For backend implementation tasks:
1. Run targeted Jest specs for touched modules, e.g. `npm --prefix fitme-sportswear-backend test -- <spec>.spec.ts`.
2. If Prisma schema changed, run `npm --prefix fitme-sportswear-backend run prisma:generate` before build/tests that depend on generated client.
3. Run full suite: `npm --prefix fitme-sportswear-backend test`.
4. Run build: `npm --prefix fitme-sportswear-backend run build`.
5. If time/env permits, run lint: `npm --prefix fitme-sportswear-backend run lint`.
6. Verify reference source untouched for backend-only work: `git status --short -- sportswear-main` should print nothing.
7. Report exact pass/fail counts and any skipped commands. Do not claim verification if a command was not run.

Commit rule from project workflow: commit/push only when user asks. Commit messages should include the Claude co-author trailer required by the CLI instructions.