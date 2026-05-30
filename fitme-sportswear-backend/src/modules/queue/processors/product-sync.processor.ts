import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ProductSyncOrchestratorService } from '../../products/product-sync-orchestrator.service';
import { ProductSyncPayload } from '../producers/product-sync.producer';
import { PRODUCT_SYNC_QUEUE } from '../queue.constants';

@Processor(PRODUCT_SYNC_QUEUE, { concurrency: 1 })
export class ProductSyncProcessor extends WorkerHost {
  constructor(private readonly orchestrator: ProductSyncOrchestratorService) {
    super();
  }

  async process(job: Job<ProductSyncPayload>) {
    await this.orchestrator.run(job.data.syncRunId);
  }
}
