import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { WEBHOOK_EVENT_JOB, WEBHOOK_EVENT_QUEUE } from '../queue.constants';

export interface WebhookEventPayload {
  webhookEventId: string;
}

@Injectable()
export class WebhookEventProducer {
  constructor(
    @InjectQueue(WEBHOOK_EVENT_QUEUE)
    private readonly queue: Queue<WebhookEventPayload>,
  ) {}

  async enqueue(payload: WebhookEventPayload) {
    return this.queue.add(WEBHOOK_EVENT_JOB, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }
}
