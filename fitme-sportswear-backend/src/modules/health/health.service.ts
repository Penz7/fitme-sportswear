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
