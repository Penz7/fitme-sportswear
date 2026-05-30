import { Module } from '@nestjs/common';
import { TelegramNotifierService } from './telegram-notifier.service';

@Module({
  providers: [TelegramNotifierService],
  exports: [TelegramNotifierService],
})
export class NotificationsModule {}
