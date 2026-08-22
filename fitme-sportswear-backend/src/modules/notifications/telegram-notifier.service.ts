import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'node:https';

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
      const payload = {
        chat_id: chatId,
        text: `${context}\n${message}`.slice(0, 3900),
      };
      const response = await this.sendTelegramRequest(botToken, payload);
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

  private async sendTelegramRequest(
    botToken: string,
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean; status: number }> {
    const apiIp = this.configString('telegram.apiIp');
    if (apiIp) {
      return this.sendTelegramRequestViaIp(botToken, payload, apiIp);
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    return { ok: response.ok, status: response.status };
  }

  private sendTelegramRequestViaIp(
    botToken: string,
    payload: Record<string, unknown>,
    apiIp: string,
  ): Promise<{ ok: boolean; status: number }> {
    const body = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
      const request = https.request(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          lookup: (_hostname, options, callback) => {
            if (options?.all) {
              callback(null, [{ address: apiIp, family: 4 }]);
              return;
            }

            callback(null, apiIp, 4);
          },
        },
        (response) => {
          response.resume();
          response.on('end', () => {
            resolve({
              ok:
                response.statusCode !== undefined &&
                response.statusCode >= 200 &&
                response.statusCode < 300,
              status: response.statusCode ?? 0,
            });
          });
        },
      );

      request.on('timeout', () => {
        request.destroy(new Error('Telegram request timed out'));
      });
      request.on('error', reject);
      request.end(body);
    });
  }
}
