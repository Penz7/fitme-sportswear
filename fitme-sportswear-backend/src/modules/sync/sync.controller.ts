import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateTestSyncDto } from './dto/create-test-sync.dto';
import {
  CreateSapoToPancakeOrderBulkSyncDto,
  CreateSapoToPancakeOrderSyncDto,
} from './dto/sapo-to-pancake-order-sync.dto';
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

  @Post('products')
  createProductSync() {
    return this.syncService.createProductSync();
  }

  @Get('products/:id')
  getProductSync(@Param('id') id: string) {
    return this.syncService.getProductSync(id);
  }

  @Post('address-mappings')
  createAddressMappingSync() {
    return this.syncService.createAddressMappingSync();
  }

  @Get('address-mappings/:id')
  getAddressMappingSync(@Param('id') id: string) {
    return this.syncService.getAddressMappingSync(id);
  }

  @Post('sapo-to-pancake-orders')
  createSapoToPancakeOrderSync(@Body() dto: CreateSapoToPancakeOrderSyncDto) {
    return this.syncService.createSapoToPancakeOrderSync(dto.sapoOrderId);
  }

  @Post('sapo-to-pancake-orders/bulk')
  createSapoToPancakeOrderBulkSync(
    @Body() dto: CreateSapoToPancakeOrderBulkSyncDto,
  ) {
    return this.syncService.createSapoToPancakeOrderBulkSync(dto);
  }

  @Post('sapo-to-pancake-orders/top-orders')
  createSapoTopOrderSync() {
    return this.syncService.createSapoTopOrderSync();
  }

  @Post('sapo-logs')
  createSapoLogSync() {
    return this.syncService.createSapoLogSync();
  }

  @Post('shopify-product-cleanup')
  createShopifyProductCleanupSync() {
    return this.syncService.createShopifyProductCleanupSync();
  }

  @Get('sapo-to-pancake-orders/:id')
  getSapoToPancakeOrderSync(@Param('id') id: string) {
    return this.syncService.getSapoToPancakeOrderSync(id);
  }
}
