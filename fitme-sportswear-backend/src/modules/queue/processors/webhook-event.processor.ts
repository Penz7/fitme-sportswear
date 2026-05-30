import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { OrderWebhookExecutionService } from '../../orders/order-webhook-execution.service';
import { OrderWebhookProcessingService } from '../../orders/order-webhook-processing.service';
import { TelegramNotifierService } from '../../notifications/telegram-notifier.service';
import { WebhookEventPayload } from '../producers/webhook-event.producer';
import { WEBHOOK_EVENT_QUEUE } from '../queue.constants';

@Processor(WEBHOOK_EVENT_QUEUE, { concurrency: 5 })
export class WebhookEventProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookEventProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderProcessingService: OrderWebhookProcessingService,
    private readonly orderExecutionService: OrderWebhookExecutionService,
    private readonly telegramNotifier: TelegramNotifierService,
  ) {
    super();
  }

  async process(job: Job<WebhookEventPayload>) {
    const { webhookEventId } = job.data;

    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: 'running',
      },
    });

    try {
      const webhookEvent = await this.prisma.webhookEvent.findUnique({
        where: { id: webhookEventId },
      });

      if (!webhookEvent) {
        throw new Error(`Webhook event not found: ${webhookEventId}`);
      }

      const plan = this.orderProcessingService.buildProcessingPlan(webhookEvent);
      await this.orderExecutionService.executePlan(plan, webhookEvent.payload);

      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: 'succeeded',
          processedAt: new Date(),
        },
      });
      this.logger.log(
        `Processed webhook event ${webhookEventId} with actions ${plan.nextActions.join(',')}`,
      );
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: 'failed',
          processedAt: new Date(),
        },
      });
      await this.telegramNotifier.sendException(
        `Webhook event processing failed: ${webhookEventId}`,
        error,
      );
      throw error;
    }
  }
}
