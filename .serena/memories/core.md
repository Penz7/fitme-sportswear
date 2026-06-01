# Core

- Monorepo-style repo with two application modules:
  - `fitme-sportswear-backend`: NestJS/TypeScript sync backend; read `mem:backend/core` for module map and operational notes.
  - `sportswear-main`: Spring Boot Java app for Sapo/Pancake/Shopify synchronization; read `mem:sportswear-main/core` for module map and operational notes.
- Root also contains `docs/`, `tai-lieu-trien-khai/`, and generated `.codebase-memory/graph.db.zst` index artifact.
- Integration domain centers on product/order/address synchronization across Sapo, Pancake, and Shopify.
- For stack/tooling details read `mem:tech_stack`; for command checklist read `mem:suggested_commands` and `mem:task_completion`; for style conventions read `mem:conventions`.