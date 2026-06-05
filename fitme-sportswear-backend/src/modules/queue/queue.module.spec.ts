import { queueProviders } from './queue.module';
import { AddressMappingSyncProcessor } from './processors/address-mapping-sync.processor';
import { ProductSyncProcessor } from './processors/product-sync.processor';
import { SapoToPancakeOrderSyncProcessor } from './processors/sapo-to-pancake-order-sync.processor';
import { TestSyncProcessor } from './processors/test-sync.processor';
import { WebhookEventProcessor } from './processors/webhook-event.processor';
import { WebhookEventProducer } from './producers/webhook-event.producer';

describe('QueueModule providers', () => {
  const processors = [
    TestSyncProcessor,
    ProductSyncProcessor,
    AddressMappingSyncProcessor,
    WebhookEventProcessor,
    SapoToPancakeOrderSyncProcessor,
  ];

  it('registers processors by default', () => {
    const providers = queueProviders();

    expect(providers).toContain(WebhookEventProducer);
    for (const processor of processors) {
      expect(providers).toContain(processor);
    }
  });

  it('can disable processors for ingest-only API runs', () => {
    const providers = queueProviders(false);

    expect(providers).toContain(WebhookEventProducer);
    for (const processor of processors) {
      expect(providers).not.toContain(processor);
    }
  });
});
