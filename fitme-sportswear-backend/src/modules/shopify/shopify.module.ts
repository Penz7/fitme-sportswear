import { Module } from '@nestjs/common';
import { CheckoutOrderReferenceController } from './checkout-order-reference.controller';
import { ShopifyClient } from './shopify.client';

@Module({
  providers: [ShopifyClient],
  controllers: [CheckoutOrderReferenceController],
  exports: [ShopifyClient],
})
export class ShopifyModule {}
