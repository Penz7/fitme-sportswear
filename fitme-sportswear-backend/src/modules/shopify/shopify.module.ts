import { Module } from '@nestjs/common';
import { ShopifyClient } from './shopify.client';

@Module({
  providers: [ShopifyClient],
  exports: [ShopifyClient],
})
export class ShopifyModule {}
