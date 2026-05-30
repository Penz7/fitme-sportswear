import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateSapoToPancakeOrderBulkSyncDto,
  CreateSapoToPancakeOrderSyncDto,
} from './sapo-to-pancake-order-sync.dto';

describe('Sapo to Pancake order sync DTOs', () => {
  it('requires sapoOrderId for single order sync', async () => {
    const dto = plainToInstance(CreateSapoToPancakeOrderSyncDto, {
      sapoOrderId: '',
    });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'sapoOrderId' }),
      ]),
    );
  });

  it('accepts optional bulk filters and transforms limit to number', async () => {
    const dto = plainToInstance(CreateSapoToPancakeOrderBulkSyncDto, {
      status: 'finalized',
      createdOnMin: '2026-05-01T00:00:00.000Z',
      createdOnMax: '2026-05-30T23:59:59.000Z',
      limit: '25',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.limit).toBe(25);
  });

  it('rejects invalid bulk filter values', async () => {
    const dto = plainToInstance(CreateSapoToPancakeOrderBulkSyncDto, {
      createdOnMin: 'not-a-date',
      limit: 1000,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['createdOnMin', 'limit']),
    );
  });
});
