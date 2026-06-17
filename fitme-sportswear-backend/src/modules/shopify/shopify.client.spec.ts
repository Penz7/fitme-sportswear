import { ConfigService } from '@nestjs/config';
import { ShopifyClient } from './shopify.client';

describe('ShopifyClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
  });

  function createClient(overrides: Record<string, string | undefined> = {}) {
    const values: Record<string, string | undefined> = {
      'shopify.baseUrl': 'https://fitme.myshopify.com/admin/api/2024-04',
      'shopify.accessToken': 'shopify-token',
      'shopify.apiVersion': '2024-04',
      'shopify.locationId': undefined,
      ...overrides,
    };

    const configService = {
      get: jest.fn((key: string) => values[key]),
      getOrThrow: jest.fn((key: string) => {
        const value = values[key];
        if (!value) {
          throw new Error(`Missing ${key}`);
        }
        return value;
      }),
    } as unknown as ConfigService;

    return new ShopifyClient(configService);
  }

  function jsonResponse(
    body: unknown,
    ok = true,
    status = 200,
    link: string | null = null,
  ) {
    return {
      ok,
      status,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'link' ? link : null),
      },
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }

  it('fetches Shopify products with token header and follows Link rel next pagination', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          { products: [{ id: 'p1', title: 'Shirt', variants: [] }] },
          true,
          200,
          '<https://fitme.myshopify.com/admin/api/2024-04/products.json?limit=250&page_info=next-page>; rel="next"',
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          products: [{ id: 'p2', title: 'Shorts', variants: [] }],
        }),
      );

    const products = await createClient().fetchProducts();

    expect(products).toEqual([
      { id: 'p1', title: 'Shirt', variants: [] },
      { id: 'p2', title: 'Shorts', variants: [] },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://fitme.myshopify.com/admin/api/2024-04/products.json?limit=250&fields=id%2Ctitle%2Cvendor%2Cproduct_type%2Cstatus%2Cimages%2Cvariants',
      { headers: { 'X-Shopify-Access-Token': 'shopify-token' } },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://fitme.myshopify.com/admin/api/2024-04/products.json?limit=250&page_info=next-page',
      { headers: { 'X-Shopify-Access-Token': 'shopify-token' } },
    );
  });

  it('throws a clear error for non-2xx product responses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ errors: 'Unauthorized' }, false, 401),
    );

    await expect(createClient().fetchProducts()).rejects.toThrow(
      'Shopify product fetch failed with status 401',
    );
  });

  it('fetches and caches the first Shopify location when location id is not configured', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          variant: {
            id: 'variant-1',
            inventory_item_id: 'inventory-item-1',
            inventory_management: 'shopify',
            price: '150000',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ locations: [{ id: 'location-1' }] }))
      .mockResolvedValueOnce(jsonResponse({ inventory_level: { available: 7 } }))
      .mockResolvedValueOnce(
        jsonResponse({
          variant: {
            id: 'variant-2',
            inventory_item_id: 'inventory-item-2',
            inventory_management: 'shopify',
            price: '180000',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ inventory_level: { available: 8 } }));

    const client = createClient();

    await client.updateInventoryAndPrice({
      variantId: 'variant-1',
      available: 7,
      retailPrice: 150000,
    });
    await client.updateInventoryAndPrice({
      variantId: 'variant-2',
      available: 8,
      retailPrice: 180000,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://fitme.myshopify.com/admin/api/2024-04/locations.json',
      { headers: { 'X-Shopify-Access-Token': 'shopify-token' } },
    );
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('uses variant inventory_item_id and sends inventory level set payload', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          variant: {
            id: 'variant-1',
            inventory_item_id: 'inventory-item-1',
            inventory_management: 'shopify',
            price: '150000',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ inventory_level: { available: 7 } }));

    await createClient({ 'shopify.locationId': 'location-9' }).updateInventoryAndPrice(
      {
        variantId: 'variant-1',
        available: 7,
        retailPrice: 150000,
      },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://fitme.myshopify.com/admin/api/2024-04/variants/variant-1.json',
      { headers: { 'X-Shopify-Access-Token': 'shopify-token' } },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://fitme.myshopify.com/admin/api/2024-04/inventory_levels/set.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': 'shopify-token',
        },
        body: JSON.stringify({
          inventory_item_id: 'inventory-item-1',
          location_id: 'location-9',
          available: 7,
        }),
      },
    );
  });

  it('updates variant inventory management and Sapo retail price when needed', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          variant: {
            id: 'variant-1',
            inventory_item_id: 'inventory-item-1',
            inventory_management: null,
            price: '150000',
            sku: 'SKU-1',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ variant: { id: 'variant-1' } }))
      .mockResolvedValueOnce(jsonResponse({ variant: { id: 'variant-1' } }))
      .mockResolvedValueOnce(jsonResponse({ inventory_level: { available: 7 } }));

    await createClient({ 'shopify.locationId': 'location-9' }).updateInventoryAndPrice(
      {
        variantId: 'variant-1',
        available: 7,
        retailPrice: 999999,
      },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://fitme.myshopify.com/admin/api/2024-04/variants/variant-1.json',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': 'shopify-token',
        },
        body: JSON.stringify({
          variant: {
            id: 'variant-1',
            inventory_management: 'shopify',
          },
        }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://fitme.myshopify.com/admin/api/2024-04/variants/variant-1.json',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': 'shopify-token',
        },
        body: JSON.stringify({
          variant: {
            id: 'variant-1',
            price: 999999,
          },
        }),
      },
    );
  });

  it('creates a Shopify fulfillment with Fulfillment Orders API', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          fulfillment_orders: [
            {
              id: 'fulfillment-order-1',
              status: 'open',
              request_status: 'unsubmitted',
              line_items: [
                {
                  id: 'fulfillment-line-1',
                  line_item_id: 'line-item-1',
                  fulfillable_quantity: 2,
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ fulfillment: { id: 'fulfillment-1' } }));

    await createClient({ 'shopify.locationId': 'location-9' }).createFulfillment({
      orderId: 'shopify-order-1',
      trackingCompany: 'Viettel',
      trackingNumber: 'VTP123',
      notifyCustomer: true,
      lineItems: [{ id: 'line-item-1', quantity: 2 }],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://fitme.myshopify.com/admin/api/2024-04/orders/shopify-order-1/fulfillment_orders.json',
      { headers: { 'X-Shopify-Access-Token': 'shopify-token' } },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://fitme.myshopify.com/admin/api/2024-04/fulfillments.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': 'shopify-token',
        },
        body: JSON.stringify({
          fulfillment: {
            line_items_by_fulfillment_order: [
              {
                fulfillment_order_id: 'fulfillment-order-1',
                fulfillment_order_line_items: [
                  { id: 'fulfillment-line-1', quantity: 2 },
                ],
              },
            ],
            tracking_info: {
              company: 'Viettel',
              number: 'VTP123',
            },
            notify_customer: true,
          },
        }),
      },
    );
  });

  it('treats closed Shopify fulfillment orders as already fulfilled', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ fulfillment_orders: [{ id: 'fulfillment-order-1', status: 'closed' }] }),
    );

    await createClient().createFulfillment({
      orderId: 'shopify-order-1',
      trackingCompany: 'Viettel',
      trackingNumber: 'VTP123',
      notifyCustomer: true,
      lineItems: [{ id: 'line-item-1', quantity: 2 }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cancels a Shopify order with the Sapo cancellation reason', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ order: { id: 'shopify-order-1' } }));

    await createClient().cancelOrder('shopify-order-1', 'Cancelled by Sapo');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://fitme.myshopify.com/admin/api/2024-04/orders/shopify-order-1/cancel.json',
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': 'shopify-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Cancelled by Sapo',
        }),
      },
    );
  });

  it('closes a Shopify order', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ order: { id: 'shopify-order-1' } }));

    await createClient().closeOrder('shopify-order-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://fitme.myshopify.com/admin/api/2024-04/orders/shopify-order-1/close.json',
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': 'shopify-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
    );
  });

  it('fetches and deletes Shopify products for cleanup', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ product: { id: 'product-1', images: [], tags: '' } }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ errors: 'not found' }, false, 404));

    await expect(createClient().fetchProduct('product-1')).resolves.toEqual({
      id: 'product-1',
      images: [],
      tags: '',
    });
    await createClient().deleteProduct('product-1');
    await expect(createClient().fetchProduct('missing-product')).resolves.toBeNull();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://fitme.myshopify.com/admin/api/2024-04/products/product-1.json',
      { headers: { 'X-Shopify-Access-Token': 'shopify-token' } },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://fitme.myshopify.com/admin/api/2024-04/products/product-1.json',
      {
        method: 'DELETE',
        headers: { 'X-Shopify-Access-Token': 'shopify-token' },
      },
    );
  });

  it('updates an existing Shopify webhook address', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        webhook: {
          id: 123,
          topic: 'orders/create',
          address: 'https://new.example.com/webhooks/shopify/order',
        },
      }),
    );

    await createClient().updateWebhook('123', {
      address: 'https://new.example.com/webhooks/shopify/order',
      format: 'json',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://fitme.myshopify.com/admin/api/2024-04/webhooks/123.json',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': 'shopify-token',
        },
        body: JSON.stringify({
          webhook: {
            id: '123',
            address: 'https://new.example.com/webhooks/shopify/order',
            format: 'json',
          },
        }),
      },
    );
  });

  it('creates a Shopify webhook subscription', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        webhook: {
          id: 456,
          topic: 'orders/cancelled',
          address: 'https://new.example.com/webhooks/shopify/order',
        },
      }),
    );

    await createClient().createWebhook({
      topic: 'orders/cancelled',
      address: 'https://new.example.com/webhooks/shopify/order',
      format: 'json',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://fitme.myshopify.com/admin/api/2024-04/webhooks.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': 'shopify-token',
        },
        body: JSON.stringify({
          webhook: {
            topic: 'orders/cancelled',
            address: 'https://new.example.com/webhooks/shopify/order',
            format: 'json',
          },
        }),
      },
    );
  });
});
