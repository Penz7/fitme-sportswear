import { SapoToPancakeInventorySyncProcessor } from './sapo-to-pancake-inventory-sync.processor';

describe('SapoToPancakeInventorySyncProcessor', () => {
  function createProcessor(lockResult: 'OK' | null = 'OK') {
    const redisClient = {
      set: jest.fn().mockResolvedValue(lockResult),
      get: jest.fn().mockResolvedValue(`${process.pid}:job-1:1000`),
      del: jest.fn().mockResolvedValue(1),
      eval: jest.fn().mockResolvedValue(1),
    };
    const queue = { client: Promise.resolve(redisClient) };
    const inventorySyncService = {
      run: jest.fn().mockResolvedValue({ updated: 1 }),
      skipBecauseAnotherRunActive: jest.fn().mockResolvedValue({
        skippedReason: 'another_inventory_sync_running',
      }),
    };
    const processor = new SapoToPancakeInventorySyncProcessor(
      inventorySyncService as any,
      queue as any,
    );

    return { processor, inventorySyncService, redisClient };
  }

  it('runs inventory sync when the distributed lock is acquired', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    const { processor, inventorySyncService, redisClient } = createProcessor('OK');

    await processor.process({
      id: 'job-1',
      data: { syncRunId: 'run-1' },
    } as any);

    expect(inventorySyncService.run).toHaveBeenCalledWith({ syncRunId: 'run-1' });
    expect(inventorySyncService.skipBecauseAnotherRunActive).not.toHaveBeenCalled();
    expect(redisClient.del).toHaveBeenCalledWith(
      'lock:sync:sapo-to-pancake-inventory-sync',
    );
  });

  it('marks the run skipped when another inventory sync is active', async () => {
    const { processor, inventorySyncService, redisClient } = createProcessor(null);

    await processor.process({
      id: 'job-2',
      data: { syncRunId: 'run-2' },
    } as any);

    expect(inventorySyncService.run).not.toHaveBeenCalled();
    expect(inventorySyncService.skipBecauseAnotherRunActive).toHaveBeenCalledWith({
      syncRunId: 'run-2',
    });
    expect(redisClient.del).not.toHaveBeenCalled();
  });

  it('renews the inventory lock while the sync is still running', async () => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    let finishRun: ((value: { updated: number }) => void) | undefined;
    const { processor, inventorySyncService, redisClient } = createProcessor('OK');
    inventorySyncService.run.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRun = resolve;
      }),
    );

    const processing = processor.process({
      id: 'job-1',
      data: { syncRunId: 'run-1' },
    } as any);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(30_000);

    expect(redisClient.eval).toHaveBeenCalledWith(
      expect.stringContaining('pexpire'),
      1,
      'lock:sync:sapo-to-pancake-inventory-sync',
      `${process.pid}:job-1:1000`,
      120_000,
    );

    finishRun?.({ updated: 1 });
    await processing;
    jest.useRealTimers();
  });
});
