import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateTestSyncDto } from './dto/create-test-sync.dto';
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
}
