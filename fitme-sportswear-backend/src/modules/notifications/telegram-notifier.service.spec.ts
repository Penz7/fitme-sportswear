import { TelegramNotifierService } from './telegram-notifier.service';

describe('TelegramNotifierService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
  });

  function createService(values: Record<string, unknown>) {
    return new TelegramNotifierService({
      get: jest.fn((key: string) => values[key]),
    } as any);
  }

  it('does nothing when Telegram config is missing', async () => {
    await createService({}).sendException('Webhook failed', new Error('bad event'));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends exception messages to Telegram when configured', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true });

    await createService({
      'telegram.botToken': 'bot-token',
      'telegram.chatId': 'chat-id',
    }).sendException('Webhook failed', new Error('bad event'));

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: 'chat-id',
          text: 'Webhook failed\nbad event',
        }),
      },
    );
  });
});
