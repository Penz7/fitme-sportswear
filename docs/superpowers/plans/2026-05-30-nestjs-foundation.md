# NestJS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the phase-one `fitme-sportswear-backend` NestJS foundation with health/config/test sync endpoints, Prisma/PostgreSQL, Redis/BullMQ, worker processing, Docker Compose local, and baseline tests.

**Architecture:** Create a new NestJS modular monolith at `C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend`. The API process handles HTTP endpoints and enqueues jobs; the worker process consumes BullMQ jobs and records durable status in the new PostgreSQL database. Sapo/Pancake/Shopify modules are connector shells only; no real business migration is implemented in phase one.

**Tech Stack:** Node.js, NestJS, TypeScript, Prisma, PostgreSQL, Redis, BullMQ, Docker Compose, Jest, Supertest.

---

## File structure

Create this source tree:

```text
fitme-sportswear-backend/
  .env.example
  .gitignore
  Dockerfile
  docker-compose.yml
  nest-cli.json
  package.json
  prisma/
    schema.prisma
  src/
    app.module.ts
    main.ts
    worker.ts
    modules/
      config/
        app-config.module.ts
        configuration.ts
        env.validation.ts
      database/
        database.module.ts
        prisma.service.ts
      health/
        health.controller.ts
        health.module.ts
        health.service.ts
      queue/
        queue.constants.ts
        queue.module.ts
        processors/
          test-sync.processor.ts
        producers/
          test-sync.producer.ts
      sync/
        dto/
          create-test-sync.dto.ts
        sync.controller.ts
        sync.module.ts
        sync.service.ts
      sapo/
        sapo.client.ts
        sapo.module.ts
      pancake/
        pancake.client.ts
        pancake.module.ts
      shopify/
        shopify.client.ts
        shopify.module.ts
      webhook/
        webhook.controller.ts
        webhook.module.ts
  test/
    app.e2e-spec.ts
    jest-e2e.json
  tsconfig.build.json
  tsconfig.json
```

Responsibilities:

- `main.ts`: API bootstrap.
- `worker.ts`: worker-only bootstrap using the same app module.
- `config`: env loading and validation.
- `database`: Prisma lifecycle.
- `health`: liveness/readiness.
- `queue`: BullMQ setup, producers, processors.
- `sync`: internal test sync endpoint and status read endpoint.
- `sapo`, `pancake`, `shopify`: typed config/client shells.
- `webhook`: no real platform webhook handling; internal status endpoint only.

---

### Task 1: Scaffold package, TypeScript, NestJS config, and environment files

**Files:**
- Create: `C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend\package.json`
- Create: `C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend\tsconfig.json`
- Create: `C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend\tsconfig.build.json`
- Create: `C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend\nest-cli.json`
- Create: `C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend\.env.example`
- Create: `C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend\.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "fitme-sportswear-backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "worker": "node dist/worker.js",
    "worker:dev": "ts-node -r tsconfig-paths/register src/worker.ts",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy"
  },
  "dependencies": {
    "@nestjs/bullmq": "^10.2.3",
    "@nestjs/common": "^10.4.15",
    "@nestjs/config": "^3.3.0",
    "@nestjs/core": "^10.4.15",
    "@nestjs/platform-express": "^10.4.15",
    "@prisma/client": "^6.1.0",
    "bullmq": "^5.34.2",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "ioredis": "^5.4.1",
    "joi": "^17.13.3",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.8",
    "@nestjs/schematics": "^10.2.3",
    "@nestjs/testing": "^10.4.15",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.10.2",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^8.18.0",
    "@typescript-eslint/parser": "^8.18.0",
    "eslint": "^9.17.0",
    "jest": "^29.7.0",
    "prisma": "^6.1.0",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.1",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.7.2"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {"^.+\\.(t|j)s$": "ts-jest"},
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 2: Create TypeScript and Nest config files**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "strict": true,
    "skipLibCheck": true,
    "strictPropertyInitialization": false
  }
}
```

`tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

`nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "entryFile": "main",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 3: Create environment and ignore files**

`.env.example`:

```text
APP_ENV=local
APP_PORT=3000
APP_VERSION=0.1.0

DATABASE_URL=postgresql://fitme:fitme@localhost:5433/fitme_sportswear_backend?schema=public
REDIS_HOST=localhost
REDIS_PORT=6380

SAPO_BASE_URL=https://example-sapo.local
SAPO_ACCESS_TOKEN=change-me

PANCAKE_BASE_URL=https://example-pancake.local
PANCAKE_API_KEY=change-me

SHOPIFY_BASE_URL=https://example-shopify.local
SHOPIFY_ACCESS_TOKEN=change-me
SHOPIFY_WEBHOOK_SECRET=change-me
```

`.gitignore`:

```text
node_modules
dist
coverage
.env
.env.local
.prisma
.superpowers
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
cd 'C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend' && npm install
```

Expected: `package-lock.json` is created and npm exits successfully.

- [ ] **Step 5: Commit**

If the root is a git repository, run:

```bash
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' add fitme-sportswear-backend/package.json fitme-sportswear-backend/package-lock.json fitme-sportswear-backend/tsconfig.json fitme-sportswear-backend/tsconfig.build.json fitme-sportswear-backend/nest-cli.json fitme-sportswear-backend/.env.example fitme-sportswear-backend/.gitignore
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' commit -m "chore: scaffold NestJS backend"
```

Expected: commit succeeds. If root is not a git repository, skip commit and record this in the task handoff.

---

### Task 2: Add config validation and API bootstrap

**Files:**
- Create: `fitme-sportswear-backend/src/modules/config/configuration.ts`
- Create: `fitme-sportswear-backend/src/modules/config/env.validation.ts`
- Create: `fitme-sportswear-backend/src/modules/config/app-config.module.ts`
- Create: `fitme-sportswear-backend/src/app.module.ts`
- Create: `fitme-sportswear-backend/src/main.ts`

- [ ] **Step 1: Write the config validation implementation**

`src/modules/config/env.validation.ts`:

```ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  APP_ENV: Joi.string().valid('local', 'test', 'development', 'production').default('local'),
  APP_PORT: Joi.number().port().default(3000),
  APP_VERSION: Joi.string().default('0.1.0'),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().required(),
  SAPO_BASE_URL: Joi.string().uri().required(),
  SAPO_ACCESS_TOKEN: Joi.string().required(),
  PANCAKE_BASE_URL: Joi.string().uri().required(),
  PANCAKE_API_KEY: Joi.string().required(),
  SHOPIFY_BASE_URL: Joi.string().uri().required(),
  SHOPIFY_ACCESS_TOKEN: Joi.string().required(),
  SHOPIFY_WEBHOOK_SECRET: Joi.string().required(),
});
```

`src/modules/config/configuration.ts`:

```ts
export default () => ({
  app: {
    env: process.env.APP_ENV ?? 'local',
    port: Number(process.env.APP_PORT ?? 3000),
    version: process.env.APP_VERSION ?? '0.1.0',
  },
  redis: {
    host: process.env.REDIS_HOST as string,
    port: Number(process.env.REDIS_PORT),
  },
  sapo: {
    baseUrl: process.env.SAPO_BASE_URL as string,
  },
  pancake: {
    baseUrl: process.env.PANCAKE_BASE_URL as string,
  },
  shopify: {
    baseUrl: process.env.SHOPIFY_BASE_URL as string,
  },
});
```

`src/modules/config/app-config.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { envValidationSchema } from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
  ],
})
export class AppConfigModule {}
```

- [ ] **Step 2: Create API bootstrap**

`src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './modules/config/app-config.module';

@Module({
  imports: [AppConfigModule],
})
export class AppModule {}
```

`src/main.ts`:

```ts
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('app.port');
  await app.listen(port);
}

void bootstrap();
```

- [ ] **Step 3: Run build**

Run:

```bash
cd 'C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend' && npm run build
```

Expected: PASS and `dist/main.js` exists.

- [ ] **Step 4: Commit**

```bash
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' add fitme-sportswear-backend/src fitme-sportswear-backend/package.json fitme-sportswear-backend/package-lock.json
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' commit -m "feat: add backend config bootstrap"
```

Expected: commit succeeds if root is a git repository.

---

### Task 3: Add Prisma schema and database module

**Files:**
- Create: `fitme-sportswear-backend/prisma/schema.prisma`
- Create: `fitme-sportswear-backend/src/modules/database/prisma.service.ts`
- Create: `fitme-sportswear-backend/src/modules/database/database.module.ts`
- Modify: `fitme-sportswear-backend/src/app.module.ts`

- [ ] **Step 1: Create Prisma schema**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SyncStatus {
  queued
  running
  succeeded
  failed
}

enum SourcePlatform {
  sapo
  pancake
  shopify
  internal
}

model SyncRun {
  id           String     @id @default(uuid())
  syncType     String
  status       SyncStatus @default(queued)
  startedAt    DateTime?
  finishedAt   DateTime?
  errorMessage String?
  metadata     Json?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@map("sync_runs")
}

model WebhookEvent {
  id              String         @id @default(uuid())
  sourcePlatform  SourcePlatform
  eventType       String
  externalEventId String?
  payload         Json
  receivedAt      DateTime       @default(now())
  processedAt     DateTime?
  status          SyncStatus     @default(queued)

  @@map("webhook_events")
}

model IdempotencyKey {
  id        String   @id @default(uuid())
  key       String
  scope     String
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@unique([key, scope])
  @@map("idempotency_keys")
}

model ExternalMapping {
  id             String         @id @default(uuid())
  sourcePlatform SourcePlatform
  sourceId       String
  targetPlatform SourcePlatform
  targetId       String
  entityType     String
  createdAt      DateTime       @default(now())

  @@index([sourcePlatform, sourceId, entityType])
  @@index([targetPlatform, targetId, entityType])
  @@map("external_mappings")
}
```

- [ ] **Step 2: Create database module**

`src/modules/database/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

`src/modules/database/database.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

- [ ] **Step 3: Register database module**

Replace `src/app.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './modules/config/app-config.module';
import { DatabaseModule } from './modules/database/database.module';

@Module({
  imports: [AppConfigModule, DatabaseModule],
})
export class AppModule {}
```

- [ ] **Step 4: Generate Prisma client**

Run:

```bash
cd 'C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend' && npm run prisma:generate
```

Expected: PASS and Prisma Client generated.

- [ ] **Step 5: Run build**

```bash
cd 'C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend' && npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' add fitme-sportswear-backend/prisma fitme-sportswear-backend/src/modules/database fitme-sportswear-backend/src/app.module.ts fitme-sportswear-backend/package.json fitme-sportswear-backend/package-lock.json
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' commit -m "feat: add Prisma database foundation"
```

---

### Task 4: Add health endpoints

**Files:**
- Create: `fitme-sportswear-backend/src/modules/health/health.service.ts`
- Create: `fitme-sportswear-backend/src/modules/health/health.controller.ts`
- Create: `fitme-sportswear-backend/src/modules/health/health.module.ts`
- Modify: `fitme-sportswear-backend/src/app.module.ts`

- [ ] **Step 1: Write health module code**

`src/modules/health/health.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  getLiveness() {
    return {
      status: 'ok',
      service: 'fitme-sportswear-backend',
      version: this.configService.getOrThrow<string>('app.version'),
      environment: this.configService.getOrThrow<string>('app.env'),
    };
  }

  async getReadiness() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ready',
      dependencies: {
        database: 'ok',
      },
    };
  }
}
```

`src/modules/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('readiness')
  getReadiness() {
    return this.healthService.getReadiness();
  }
}
```

`src/modules/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
```

- [ ] **Step 2: Register health module**

Replace `src/app.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './modules/config/app-config.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule],
})
export class AppModule {}
```

- [ ] **Step 3: Run build**

```bash
cd 'C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend' && npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' add fitme-sportswear-backend/src/modules/health fitme-sportswear-backend/src/app.module.ts
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' commit -m "feat: add health endpoints"
```

---

### Task 5: Add BullMQ queue, test producer, and worker processor

**Files:**
- Create: `fitme-sportswear-backend/src/modules/queue/queue.constants.ts`
- Create: `fitme-sportswear-backend/src/modules/queue/producers/test-sync.producer.ts`
- Create: `fitme-sportswear-backend/src/modules/queue/processors/test-sync.processor.ts`
- Create: `fitme-sportswear-backend/src/modules/queue/queue.module.ts`
- Create: `fitme-sportswear-backend/src/worker.ts`
- Modify: `fitme-sportswear-backend/src/app.module.ts`

- [ ] **Step 1: Create queue constants and producer**

`src/modules/queue/queue.constants.ts`:

```ts
export const TEST_SYNC_QUEUE = 'test-sync';
export const TEST_SYNC_JOB = 'test-sync.run';
```

`src/modules/queue/producers/test-sync.producer.ts`:

```ts
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { TEST_SYNC_JOB, TEST_SYNC_QUEUE } from '../queue.constants';

export interface TestSyncPayload {
  syncRunId: string;
  message: string;
}

@Injectable()
export class TestSyncProducer {
  constructor(@InjectQueue(TEST_SYNC_QUEUE) private readonly queue: Queue<TestSyncPayload>) {}

  async enqueue(payload: TestSyncPayload) {
    return this.queue.add(TEST_SYNC_JOB, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }
}
```

- [ ] **Step 2: Create worker processor**

`src/modules/queue/processors/test-sync.processor.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { TEST_SYNC_QUEUE } from '../queue.constants';
import { TestSyncPayload } from '../producers/test-sync.producer';

@Processor(TEST_SYNC_QUEUE, { concurrency: 5 })
export class TestSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(TestSyncProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<TestSyncPayload>) {
    const { syncRunId, message } = job.data;

    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status: 'running',
        startedAt: new Date(),
        metadata: { message, jobId: String(job.id) },
      },
    });

    this.logger.log(`Processed test sync job ${job.id}`);

    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
      },
    });
  }
}
```

- [ ] **Step 3: Create queue module**

`src/modules/queue/queue.module.ts`:

```ts
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TestSyncProcessor } from './processors/test-sync.processor';
import { TestSyncProducer } from './producers/test-sync.producer';
import { TEST_SYNC_QUEUE } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('redis.host'),
          port: configService.getOrThrow<number>('redis.port'),
        },
      }),
    }),
    BullModule.registerQueue({ name: TEST_SYNC_QUEUE }),
  ],
  providers: [TestSyncProducer, TestSyncProcessor],
  exports: [TestSyncProducer],
})
export class QueueModule {}
```

- [ ] **Step 4: Register queue module and worker bootstrap**

Replace `src/app.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './modules/config/app-config.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { QueueModule } from './modules/queue/queue.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule, QueueModule],
})
export class AppModule {}
```

`src/worker.ts`:

```ts
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule);
  Logger.log('Worker started', 'WorkerBootstrap');
}

void bootstrap();
```

- [ ] **Step 5: Run build**

```bash
cd 'C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend' && npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' add fitme-sportswear-backend/src/modules/queue fitme-sportswear-backend/src/worker.ts fitme-sportswear-backend/src/app.module.ts
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' commit -m "feat: add BullMQ test worker"
```

---

### Task 6: Add sync test endpoints and public config endpoint

**Files:**
- Create: `fitme-sportswear-backend/src/modules/sync/dto/create-test-sync.dto.ts`
- Create: `fitme-sportswear-backend/src/modules/sync/sync.service.ts`
- Create: `fitme-sportswear-backend/src/modules/sync/sync.controller.ts`
- Create: `fitme-sportswear-backend/src/modules/sync/sync.module.ts`
- Create: `fitme-sportswear-backend/src/modules/config/public-config.controller.ts`
- Modify: `fitme-sportswear-backend/src/modules/config/app-config.module.ts`
- Modify: `fitme-sportswear-backend/src/app.module.ts`

- [ ] **Step 1: Create sync DTO, service, controller, and module**

`src/modules/sync/dto/create-test-sync.dto.ts`:

```ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTestSyncDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
```

`src/modules/sync/sync.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TestSyncProducer } from '../queue/producers/test-sync.producer';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly testSyncProducer: TestSyncProducer,
  ) {}

  async createTestSync(message = 'test sync') {
    const syncRun = await this.prisma.syncRun.create({
      data: {
        syncType: 'test-sync',
        status: 'queued',
        metadata: { message },
      },
    });

    await this.testSyncProducer.enqueue({ syncRunId: syncRun.id, message });

    return {
      id: syncRun.id,
      status: syncRun.status,
      syncType: syncRun.syncType,
    };
  }

  async getTestSync(id: string) {
    const syncRun = await this.prisma.syncRun.findUnique({ where: { id } });

    if (!syncRun || syncRun.syncType !== 'test-sync') {
      throw new NotFoundException('Test sync run not found');
    }

    return syncRun;
  }
}
```

`src/modules/sync/sync.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateTestSyncDto } from './dto/create-test-sync.dto';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('test')
  createTestSync(@Body() dto: CreateTestSyncDto) {
    return this.syncService.createTestSync(dto.message);
  }

  @Get('test/:id')
  getTestSync(@Param('id') id: string) {
    return this.syncService.getTestSync(id);
  }
}
```

`src/modules/sync/sync.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [QueueModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
```

- [ ] **Step 2: Create public config endpoint**

`src/modules/config/public-config.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TEST_SYNC_QUEUE } from '../queue/queue.constants';

@Controller('config')
export class PublicConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('public')
  getPublicConfig() {
    return {
      environment: this.configService.getOrThrow<string>('app.env'),
      version: this.configService.getOrThrow<string>('app.version'),
      queues: [TEST_SYNC_QUEUE],
      platforms: ['sapo', 'pancake', 'shopify'],
    };
  }
}
```

Replace `src/modules/config/app-config.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { envValidationSchema } from './env.validation';
import { PublicConfigController } from './public-config.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
  ],
  controllers: [PublicConfigController],
})
export class AppConfigModule {}
```

- [ ] **Step 3: Register sync module**

Replace `src/app.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './modules/config/app-config.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { QueueModule } from './modules/queue/queue.module';
import { SyncModule } from './modules/sync/sync.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule, QueueModule, SyncModule],
})
export class AppModule {}
```

- [ ] **Step 4: Run build**

```bash
cd 'C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend' && npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' add fitme-sportswear-backend/src/modules/sync fitme-sportswear-backend/src/modules/config fitme-sportswear-backend/src/app.module.ts
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' commit -m "feat: add test sync endpoints"
```

---

### Task 7: Add connector shells and webhook internal endpoint

**Files:**
- Create: `fitme-sportswear-backend/src/modules/sapo/sapo.client.ts`
- Create: `fitme-sportswear-backend/src/modules/sapo/sapo.module.ts`
- Create: `fitme-sportswear-backend/src/modules/pancake/pancake.client.ts`
- Create: `fitme-sportswear-backend/src/modules/pancake/pancake.module.ts`
- Create: `fitme-sportswear-backend/src/modules/shopify/shopify.client.ts`
- Create: `fitme-sportswear-backend/src/modules/shopify/shopify.module.ts`
- Create: `fitme-sportswear-backend/src/modules/webhook/webhook.controller.ts`
- Create: `fitme-sportswear-backend/src/modules/webhook/webhook.module.ts`
- Modify: `fitme-sportswear-backend/src/app.module.ts`

- [ ] **Step 1: Create platform connector shells**

`src/modules/sapo/sapo.client.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SapoClient {
  constructor(private readonly configService: ConfigService) {}

  getBaseUrl() {
    return this.configService.getOrThrow<string>('sapo.baseUrl');
  }
}
```

`src/modules/sapo/sapo.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { SapoClient } from './sapo.client';

@Module({
  providers: [SapoClient],
  exports: [SapoClient],
})
export class SapoModule {}
```

`src/modules/pancake/pancake.client.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PancakeClient {
  constructor(private readonly configService: ConfigService) {}

  getBaseUrl() {
    return this.configService.getOrThrow<string>('pancake.baseUrl');
  }
}
```

`src/modules/pancake/pancake.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PancakeClient } from './pancake.client';

@Module({
  providers: [PancakeClient],
  exports: [PancakeClient],
})
export class PancakeModule {}
```

`src/modules/shopify/shopify.client.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ShopifyClient {
  constructor(private readonly configService: ConfigService) {}

  getBaseUrl() {
    return this.configService.getOrThrow<string>('shopify.baseUrl');
  }
}
```

`src/modules/shopify/shopify.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ShopifyClient } from './shopify.client';

@Module({
  providers: [ShopifyClient],
  exports: [ShopifyClient],
})
export class ShopifyModule {}
```

- [ ] **Step 2: Create webhook internal endpoint**

`src/modules/webhook/webhook.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('webhooks')
export class WebhookController {
  @Get('internal/status')
  getStatus() {
    return {
      status: 'not-configured',
      message: 'Real platform webhook handling is intentionally out of scope for phase one.',
    };
  }
}
```

`src/modules/webhook/webhook.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [WebhookController],
})
export class WebhookModule {}
```

- [ ] **Step 3: Register modules**

Replace `src/app.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './modules/config/app-config.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { PancakeModule } from './modules/pancake/pancake.module';
import { QueueModule } from './modules/queue/queue.module';
import { SapoModule } from './modules/sapo/sapo.module';
import { ShopifyModule } from './modules/shopify/shopify.module';
import { SyncModule } from './modules/sync/sync.module';
import { WebhookModule } from './modules/webhook/webhook.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    QueueModule,
    SapoModule,
    PancakeModule,
    ShopifyModule,
    SyncModule,
    WebhookModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Run build**

```bash
cd 'C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend' && npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' add fitme-sportswear-backend/src/modules/sapo fitme-sportswear-backend/src/modules/pancake fitme-sportswear-backend/src/modules/shopify fitme-sportswear-backend/src/modules/webhook fitme-sportswear-backend/src/app.module.ts
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' commit -m "feat: add connector module shells"
```

---

### Task 8: Add Docker Compose local operation

**Files:**
- Create: `fitme-sportswear-backend/Dockerfile`
- Create: `fitme-sportswear-backend/docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

`Dockerfile`:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
CMD ["node", "dist/main.js"]
```

- [ ] **Step 2: Create Docker Compose file**

`docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: fitme
      POSTGRES_PASSWORD: fitme
      POSTGRES_DB: fitme_sportswear_backend
    ports:
      - "5433:5432"
    volumes:
      - fitme_postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"

  api:
    build: .
    command: sh -c "npm run prisma:deploy && node dist/main.js"
    env_file:
      - .env
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

  worker:
    build: .
    command: sh -c "npm run prisma:deploy && node dist/worker.js"
    env_file:
      - .env
    depends_on:
      - postgres
      - redis

volumes:
  fitme_postgres_data:
```

- [ ] **Step 3: Run build**

```bash
cd 'C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend' && npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' add fitme-sportswear-backend/Dockerfile fitme-sportswear-backend/docker-compose.yml
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' commit -m "chore: add local Docker Compose"
```

---

### Task 9: Add e2e tests for health, public config, and test sync

**Files:**
- Create: `fitme-sportswear-backend/test/jest-e2e.json`
- Create: `fitme-sportswear-backend/test/app.e2e-spec.ts`

- [ ] **Step 1: Create e2e Jest config**

`test/jest-e2e.json`:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

- [ ] **Step 2: Create e2e tests**

`test/app.e2e-spec.ts`:

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/database/prisma.service';

describe('App e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns liveness', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'fitme-sportswear-backend',
    });
    expect(response.body.version).toBeDefined();
  });

  it('returns readiness', async () => {
    const response = await request(app.getHttpServer()).get('/health/readiness').expect(200);

    expect(response.body).toEqual({
      status: 'ready',
      dependencies: {
        database: 'ok',
      },
    });
  });

  it('returns public config without secrets', async () => {
    const response = await request(app.getHttpServer()).get('/config/public').expect(200);

    expect(response.body).toMatchObject({
      queues: ['test-sync'],
      platforms: ['sapo', 'pancake', 'shopify'],
    });
    expect(JSON.stringify(response.body)).not.toContain('change-me');
    expect(JSON.stringify(response.body)).not.toContain('DATABASE_URL');
  });

  it('creates and reads a test sync run', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/sync/test')
      .send({ message: 'hello sync' })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      status: 'queued',
      syncType: 'test-sync',
    });

    const id = createResponse.body.id as string;
    const readResponse = await request(app.getHttpServer()).get(`/sync/test/${id}`).expect(200);

    expect(readResponse.body).toMatchObject({
      id,
      syncType: 'test-sync',
      status: 'queued',
    });

    await prisma.syncRun.delete({ where: { id } });
  });
});
```

- [ ] **Step 3: Run e2e tests with local infra**

Ensure `.env` exists by copying `.env.example`, then start only PostgreSQL and Redis:

```bash
cd 'C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend' && cp .env.example .env && docker compose up -d postgres redis && npm run prisma:migrate -- --name init && npm run test:e2e
```

Expected: all e2e tests PASS.

- [ ] **Step 4: Commit**

```bash
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' add fitme-sportswear-backend/test fitme-sportswear-backend/package.json fitme-sportswear-backend/package-lock.json
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' commit -m "test: add backend foundation e2e tests"
```

---

### Task 10: Verify full local flow

**Files:**
- Modify only if verification reveals a concrete issue in files created above.

- [ ] **Step 1: Start full local stack**

Run:

```bash
cd 'C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend' && docker compose up --build
```

Expected: `api` listens on port `3000`, `worker` logs `Worker started`, PostgreSQL and Redis are healthy enough for the services to start.

- [ ] **Step 2: Verify health endpoint**

In another terminal, run:

```bash
curl http://localhost:3000/health
```

Expected response contains:

```json
{"status":"ok","service":"fitme-sportswear-backend"}
```

- [ ] **Step 3: Verify readiness endpoint**

Run:

```bash
curl http://localhost:3000/health/readiness
```

Expected response:

```json
{"status":"ready","dependencies":{"database":"ok"}}
```

- [ ] **Step 4: Verify public config endpoint**

Run:

```bash
curl http://localhost:3000/config/public
```

Expected response includes `test-sync`, `sapo`, `pancake`, and `shopify`, and does not include tokens or database URLs.

- [ ] **Step 5: Verify test sync enqueue**

Run:

```bash
curl -X POST http://localhost:3000/sync/test -H "Content-Type: application/json" -d "{\"message\":\"manual local test\"}"
```

Expected response contains an `id`, `status` is `queued`, and `syncType` is `test-sync`.

- [ ] **Step 6: Verify worker completion**

Use the returned id:

```bash
curl http://localhost:3000/sync/test/<returned-id>
```

Expected after a short wait: `status` becomes `succeeded` and `finishedAt` is not null.

- [ ] **Step 7: Run all checks**

```bash
cd 'C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend' && npm run build && npm run test:e2e
```

Expected: PASS.

- [ ] **Step 8: Commit final verification fixes if any**

If fixes were required:

```bash
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' add fitme-sportswear-backend
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' commit -m "fix: stabilize backend local foundation"
```

Expected: commit succeeds if root is a git repository. If no fixes were required, no commit is needed.

---

## Self-review

- Spec coverage: the plan covers the new `fitme-sportswear-backend` source, NestJS modular monolith, Prisma/PostgreSQL, Redis/BullMQ, health/config/test sync endpoints, worker test job, Docker Compose local, and baseline e2e tests. It explicitly excludes product/order/customer migration.
- Placeholder scan: the plan contains no unfinished markers or undefined future implementation steps for phase one.
- Type consistency: `SyncStatus`, `SyncRun`, `TEST_SYNC_QUEUE`, `TEST_SYNC_JOB`, `TestSyncProducer`, and endpoint paths are consistent across tasks.
