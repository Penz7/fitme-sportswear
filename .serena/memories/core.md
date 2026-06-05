# Core

Repo has two important trees:
- `fitme-sportswear-backend/`: active NestJS backend; modify this for backend work.
- `sportswear-main/`: legacy Java reference for business-flow parity; read-only unless user explicitly says otherwise.

Backend integrates Sapo, Pancake, Shopify. Main processes: API receives operational requests/webhooks; worker processes BullMQ jobs from Redis; PostgreSQL/Prisma stores sync runs, webhooks, mappings, product/order snapshots.

Read `mem:backend/core` for backend module map and integration invariants. Read `mem:tech_stack` for versions/tools. Read `mem:suggested_commands` for run/test commands. Read `mem:conventions` for coding patterns. Read `mem:task_completion` before closing implementation tasks.