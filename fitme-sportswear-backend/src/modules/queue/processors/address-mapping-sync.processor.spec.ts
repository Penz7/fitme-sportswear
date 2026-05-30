import { AddressMappingSyncProcessor } from './address-mapping-sync.processor';

describe('AddressMappingSyncProcessor', () => {
  function createProcessor() {
    const prisma = {
      syncRun: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const addressSyncService = {
      syncAddressMappings: jest.fn().mockResolvedValue({
        provinces: 1,
        districts: 2,
        wards: 3,
      }),
    };

    return {
      prisma,
      addressSyncService,
      processor: new AddressMappingSyncProcessor(
        prisma as any,
        addressSyncService as any,
      ),
    };
  }

  it('marks the sync run running, syncs address mappings, and marks succeeded', async () => {
    const { processor, prisma, addressSyncService } = createProcessor();

    await processor.process({ data: { syncRunId: 'sync-run-1' } } as any);

    expect(prisma.syncRun.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'sync-run-1' },
      data: { status: 'running', startedAt: expect.any(Date) },
    });
    expect(addressSyncService.syncAddressMappings).toHaveBeenCalled();
    expect(prisma.syncRun.update).toHaveBeenLastCalledWith({
      where: { id: 'sync-run-1' },
      data: {
        status: 'succeeded',
        finishedAt: expect.any(Date),
        metadata: { provinces: 1, districts: 2, wards: 3 },
      },
    });
  });

  it('marks failed and rethrows when address sync fails', async () => {
    const { processor, prisma, addressSyncService } = createProcessor();
    addressSyncService.syncAddressMappings.mockRejectedValue(
      new Error('Sapo unavailable'),
    );

    await expect(
      processor.process({ data: { syncRunId: 'sync-run-1' } } as any),
    ).rejects.toThrow('Sapo unavailable');
    expect(prisma.syncRun.update).toHaveBeenLastCalledWith({
      where: { id: 'sync-run-1' },
      data: {
        status: 'failed',
        finishedAt: expect.any(Date),
        errorMessage: 'Sapo unavailable',
      },
    });
  });
});
