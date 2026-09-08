import { Module } from '@nestjs/common';
import { PreorderApiTokenGuard } from './preorder-api-token.guard';
import { PreorderController } from './preorder.controller';
import { PreorderOperationsService } from './preorder-operations.service';
import { PreorderService } from './preorder.service';

@Module({
  controllers: [PreorderController],
  providers: [PreorderService, PreorderOperationsService, PreorderApiTokenGuard],
  exports: [PreorderService, PreorderOperationsService],
})
export class PreorderModule {}
