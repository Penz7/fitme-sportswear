import { OrderPreflightController } from './order-preflight.controller';

describe('OrderPreflightController', () => {
  it('returns only the redacted Pancake-to-Sapo preflight result', async () => {
    const pancakeClient = {
      fetchOrder: jest.fn().mockResolvedValue({
        data: { id: 'pancake-order-1', bill_phone_number: '0909000000' },
      }),
    };
    const preflightService = {
      preflight: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        sapoOrder: { phone_number: '0909000000' },
        prepayment: null,
        preview: {
          pancakeOrderId: 'pancake-order-1',
          customer: { phone: '[REDACTED]' },
        },
      }),
    };
    const controller = new OrderPreflightController(
      pancakeClient as any,
      preflightService as any,
    );

    await expect(
      controller.preflightPancakeOrder('pancake-order-1'),
    ).resolves.toEqual({
      valid: true,
      errors: [],
      preview: {
        pancakeOrderId: 'pancake-order-1',
        customer: { phone: '[REDACTED]' },
      },
    });
    expect(pancakeClient.fetchOrder).toHaveBeenCalledWith('pancake-order-1');
    expect(preflightService.preflight).toHaveBeenCalledWith({
      id: 'pancake-order-1',
      bill_phone_number: '0909000000',
    });
  });
});
