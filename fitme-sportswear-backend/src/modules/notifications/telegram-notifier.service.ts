import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramNotifierService {
  private readonly logger = new Logger(TelegramNotifierService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendException(context: string, error: unknown): Promise<void> {
    await this.sendMessage(
      context,
      error instanceof Error ? error.message : String(error),
    );
  }

  async sendMessage(context: string, message: string): Promise<void> {
    const botToken = this.configString('telegram.botToken');
    const chatId = this.configString('telegram.chatId');

    if (!botToken || !chatId) {
      return;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `${context}\n${message}`.slice(0, 3900),
          }),
        },
      );
      if (!response.ok) {
        this.logger.warn(`Telegram notification failed with status ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Telegram notification failed: ${message}`);
    }
  }

  private configString(key: string): string | null {
    const value = this.configService.get<string | undefined>(key);
    return value === undefined || value === null || String(value).trim() === ''
      ? null
      : String(value);
  }
}
