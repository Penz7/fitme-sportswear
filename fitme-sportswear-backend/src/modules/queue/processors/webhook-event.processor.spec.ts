import { WebhookEventProcessor } from './webhook-event.processor';

describe('WebhookEventProcessor', () => {
  it('loads a webhook event, builds an order processing plan, and marks it succeeded', async () => {
    const webhookEvent = {
      id: 'webhook-event-1',
      sourcePlatform: 'pancake',
      eventType: 'order_updated',
      payload: { id: 'pancake-order-1', status: 1 },
    };
    const prisma = {
      webhookEvent: {
        findUnique: jest.fn().mockResolvedValue(webhookEvent),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const orderProcessingService = {
      buildProcessingPlan: jest.fn().mockReturnValue({
        nextActions: ['update_sapo_order', 'prepare_viettelpost_handoff'],
      }),
    };
    const orderExecutionService = {
      executePlan: jest.fn().mockResolvedValue(undefined),
    };
    const telegramNotifier = {
      sendException: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new WebhookEventProcessor(
      prisma as any,
      orderProcessingService as any,
      orderExecutionService as any,
      telegramNotifier as any,
    );

    await processor.process({
      data: { webhookEventId: 'webhook-event-1' },
      id: 'job-1',
    } as any);

    expect(prisma.webhookEvent.findUnique).toHaveBeenCalledWith({
      where: { id: 'webhook-event-1' },
    });
    expect(orderProcessingService.buildProcessingPlan).toHaveBeenCalledWith(
      webhookEvent,
    );
    expect(orderExecutionService.executePlan).toHaveBeenCalledWith(
      {
        nextActions: ['update_sapo_order', 'prepare_viettelpost_handoff'],
      },
      webhookEvent.payload,
    );
    expect(prisma.webhookEvent.update).toHaveBeenLastCalledWith({
      where: { id: 'webhook-event-1' },
      data: {
        status: 'succeeded',
        processedAt: expect.any(Date),
      },
    });
  });

  it('marks the webhook event failed when processing throws', async () => {
    const prisma = {
      webhookEvent: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'webhook-event-2',
          sourcePlatform: 'pancake',
          eventType: 'order_updated',
          payload: {},
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const orderProcessingService = {
      buildProcessingPlan: jest.fn(() => {
        throw new Error('bad event');
      }),
    };
    const orderExecutionService = {
      executePlan: jest.fn().mockResolvedValue(undefined),
    };
    const telegramNotifier = {
      sendException: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new WebhookEventProcessor(
      prisma as any,
      orderProcessingService as any,
      orderExecutionService as any,
      telegramNotifier as any,
    );

    await expect(
      processor.process({ data: { webhookEventId: 'webhook-event-2' } } as any),
    ).rejects.toThrow('bad event');
    expect(prisma.webhookEvent.update).toHaveBeenLastCalledWith({
      where: { id: 'webhook-event-2' },
      data: {
        status: 'failed',
        processedAt: expect.any(Date),
      },
    });
    expect(telegramNotifier.sendException).toHaveBeenCalledWith(
      'Webhook event processing failed: webhook-event-2',
      expect.any(Error),
    );
  });
});
