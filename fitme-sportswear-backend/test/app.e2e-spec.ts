import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
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
    });
    expect(['queued', 'running', 'succeeded']).toContain(readResponse.body.status);

    await prisma.syncRun.delete({ where: { id } });
  });
});
