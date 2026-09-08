import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PreorderApiTokenGuard } from './preorder-api-token.guard';
import { PreorderOperationsService } from './preorder-operations.service';

@UseGuards(PreorderApiTokenGuard)
@Controller('preorders')
export class PreorderController {
  constructor(private readonly operations: PreorderOperationsService) {}

  @Get('operations')
  dashboard() {
    return this.operations.dashboard();
  }

  @Get('orders')
  orders(@Query('status') status?: string) {
    const normalized = status === 'waiting' || status === 'ready' ? status : 'all';
    return this.operations.orders(normalized);
  }
}
