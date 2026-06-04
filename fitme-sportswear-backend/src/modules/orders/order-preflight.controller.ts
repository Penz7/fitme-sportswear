import { Controller, Get, Param } from '@nestjs/common';
import { PancakeClient } from '../pancake/pancake.client';
import { PancakeToSapoPreflightService } from './pancake-to-sapo-preflight.service';

@Controller('orders/preflight')
export class OrderPreflightController {
  constructor(
    private readonly pancakeClient: PancakeClient,
    private readonly preflightService: PancakeToSapoPreflightService,
  ) {}

  @Get('pancake/:orderId')
  async preflightPancakeOrder(@Param('orderId') orderId: string) {
    const response = await this.pancakeClient.fetchOrder(orderId);
    const payload = response.data ?? response;
    const result = await this.preflightService.preflight(payload);

    return {
      valid: result.valid,
      errors: result.errors,
      preview: result.preview,
    };
  }
}
