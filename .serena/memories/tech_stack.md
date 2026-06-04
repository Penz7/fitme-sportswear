# Tech Stack

- `fitme-sportswear-backend`: Node/NestJS 10, TypeScript 5.7 strict mode, CommonJS build target ES2021, Prisma 6 with PostgreSQL, BullMQ/ioredis queues, Jest/ts-jest, ESLint 9.
- `sportswear-main`: Java 21, Spring Boot 3.4.3, Maven, Spring Web/JPA/Cache/Actuator, PostgreSQL runtime, H2 runtime, Caffeine cache, Lombok, MapStruct 1.6.3, Jersey 2.25.1, Jackson, hibernate-types.
- Database/search notes: backend Prisma schema uses PostgreSQL; root README documents PostgreSQL `pg_trgm` extension for fuzzy address/name matching.
- Runtime integrations include Sapo, Pancake, Shopify, Telegram notifications, and Gemini address normalization in Spring config.