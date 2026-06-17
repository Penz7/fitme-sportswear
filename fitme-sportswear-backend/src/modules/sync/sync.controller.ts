import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CreateTestSyncDto } from './dto/create-test-sync.dto';
import {
  CreateSapoToPancakeOrderBulkSyncDto,
  CreateSapoToPancakeOrderSyncDto,
  CreateSapoTopOrderSyncDto,
} from './dto/sapo-to-pancake-order-sync.dto';
import { SyncApiTokenGuard } from './sync-api-token.guard';
import { SyncService } from './sync.service';

@UseGuards(SyncApiTokenGuard)
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

  @Post('sapo-to-pancake-inventory')
  createSapoToPancakeInventorySync(
    @Body()
    body: {
      dryRun?: boolean;
      approved?: boolean;
      productIds?: string[];
      skus?: string[];
    },
  ) {
    return this.syncService.createSapoToPancakeInventorySync(body ?? {});
  }

  @Get('sapo-to-pancake-inventory/:id')
  getSapoToPancakeInventorySync(@Param('id') id: string) {
    return this.syncService.getSapoToPancakeInventorySync(id);
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
  createSapoTopOrderSync(@Body() dto: CreateSapoTopOrderSyncDto = {}) {
    return this.syncService.createSapoTopOrderSync(dto);
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
