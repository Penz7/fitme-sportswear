import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramNotifierService {
  constructor(private readonly configService: ConfigService) {}

  async sendException(context: string, error: unknown): Promise<void> {
    const botToken = this.configString('telegram.botToken');
    const chatId = this.configString('telegram.chatId');

    if (!botToken || !chatId) {
      return;
    }

    const message = `${context}\n${error instanceof Error ? error.message : String(error)}`;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message.slice(0, 3900),
      }),
    });
  }

  private configString(key: string): string | null {
    const value = this.configService.get<string | undefined>(key);
    return value === undefined || value === null || String(value).trim() === ''
      ? null
      : String(value);
  }
}
