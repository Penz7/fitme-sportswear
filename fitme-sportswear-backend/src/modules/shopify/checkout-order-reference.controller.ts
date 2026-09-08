import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { ShopifyClient } from './shopify.client';

@Controller('public/checkout-orders')
export class CheckoutOrderReferenceController {
  constructor(private readonly shopifyClient: ShopifyClient) {}

  @Get('reference')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Cache-Control', 'no-store')
  async getReference(
    @Query('orderId') orderId: string,
    @Query('checkoutToken') checkoutToken: string,
  ) {
    if (!/^\d+$/.test(orderId ?? '') || !checkoutToken?.trim()) {
      throw new BadRequestException('Invalid checkout order reference request');
    }

    const order = await this.shopifyClient.fetchOrder(orderId);
    const storedCheckoutToken = this.stringValue(order?.checkout_token);
    const orderNumber = this.stringValue(order?.order_number);
    if (
      !order ||
      !storedCheckoutToken ||
      !orderNumber ||
      !this.tokensMatch(storedCheckoutToken, checkoutToken)
    ) {
      throw new NotFoundException('Checkout order reference not found');
    }

    return { reference: `FITME ${orderNumber}` };
  }

  private tokensMatch(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual.trim());
    return (
      expectedBuffer.length === actualBuffer.length &&
      timingSafeEqual(expectedBuffer, actualBuffer)
    );
  }

  private stringValue(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }
}
