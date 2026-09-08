import { CheckoutOrderReferenceController } from './checkout-order-reference.controller';

describe('CheckoutOrderReferenceController', () => {
  const shopifyClient = { fetchOrder: jest.fn() };
  const controller = new CheckoutOrderReferenceController(shopifyClient as any);

  beforeEach(() => jest.resetAllMocks());

  it('returns the human-facing Shopify order number only for its checkout token', async () => {
    shopifyClient.fetchOrder.mockResolvedValue({
      order_number: 2007,
      checkout_token: 'opaque-checkout-token',
    });

    await expect(
      controller.getReference('7664686727477', 'opaque-checkout-token'),
    ).resolves.toEqual({ reference: 'FITME 2007' });
  });

  it('does not disclose an order reference for another checkout token', async () => {
    shopifyClient.fetchOrder.mockResolvedValue({
      order_number: 2007,
      checkout_token: 'opaque-checkout-token',
    });

    await expect(
      controller.getReference('7664686727477', 'another-checkout-token'),
    ).rejects.toMatchObject({ status: 404 });
  });
});
