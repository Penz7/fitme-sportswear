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
