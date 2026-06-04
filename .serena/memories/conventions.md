# Conventions

- Backend NestJS code is module-oriented under `src/modules/<domain>` with colocated `*.service.ts`, `*.client.ts`, `*.controller.ts`, `*.module.ts`, and `*.spec.ts` files.
- Backend TypeScript is strict; `strictPropertyInitialization` is disabled to support Nest/DTO/decorator patterns.
- Backend persistence is Prisma-first; database table names are explicit via `@@map` and snake_case physical table names.
- Backend sync entities use lowercase enum values in Prisma (`queued`, `running`, `succeeded`, `failed`; platform names lowercase).
- Spring app uses package-by-layer under `vn.fitme.sportswear` (`controller`, `service`, `repository`, `mapper`, `processor`, `scheduler`, etc.).
- Spring config profiles are YAML-based (`application.yaml` plus profile files); default active profile in base config is `prod` unless overridden.
- Spring uses Lombok and MapStruct annotation processing; prefer generated mapping patterns over hand-written repetitive mapping when extending existing mappers.