import { ConfigService } from '@nestjs/config';
import { PancakeClient } from './pancake.client';

describe('PancakeClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
  });

  function createClient(overrides: Record<string, string | undefined> = {}) {
    const values: Record<string, string | undefined> = {
      'pancake.baseUrl': 'https://pos.pages.fm/api/v1',
      'pancake.apiKey': 'pancake-key',
      'pancake.shopId': 'shop-1',
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

    return new PancakeClient(configService);
  }

  function jsonResponse(body: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  }

  it('fetches variation pages with api_key, page_size, and page_number', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 'v1',
              displayId: 'SKU-1',
              productId: 'p1',
              product: { name: 'Shirt' },
              retailPrice: 100000,
              variationsWarehouses: [],
            },
          ],
          total_pages: 2,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 'v2',
              displayId: 'SKU-2',
              productId: 'p2',
              product: { name: 'Shorts' },
              retailPrice: 200000,
              variationsWarehouses: [],
            },
          ],
          total_pages: 2,
        }),
      );

    const products = await createClient().fetchProducts();

    expect(products).toHaveLength(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://pos.pages.fm/api/v1/shops/shop-1/products/variations?page_size=1000&page_number=1&api_key=pancake-key',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://pos.pages.fm/api/v1/shops/shop-1/products/variations?page_size=1000&page_number=2&api_key=pancake-key',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('retries transient Pancake product fetch failures before failing the sync', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'temporary' }, false, 500))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 'v1',
              displayId: 'SKU-1',
              productId: 'p1',
              product: { name: 'Shirt' },
              retailPrice: 100000,
              variationsWarehouses: [],
            },
          ],
          total_pages: 1,
        }),
      );

    const products = await createClient({
      'pancake.productRetryBackoffMs': '1',
    }).fetchProducts();

    expect(products).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops pagination when data is empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], total_pages: 5 }));

    const products = await createClient().fetchProducts();

    expect(products).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends variations_warehouses payload for quantity update', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    await createClient().updateInventory({
      variantId: 'variant-1',
      warehouseId: 'warehouse-1',
      available: 12,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://pos.pages.fm/api/v1/shops/shop-1/variations/variant-1/update_quantity?api_key=pancake-key',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variations_warehouses: [
            { warehouse_id: 'warehouse-1', remain_quantity: 12 },
          ],
        }),
      }),
    );
  });

  it('throws when updateInventory receives no warehouse id', async () => {
    await expect(
      createClient().updateInventory({
        variantId: 'variant-1',
        warehouseId: null,
        available: 12,
      }),
    ).rejects.toThrow('Pancake warehouseId is required for inventory update');
  });

  it('creates Pancake products with custom_id and barcode from Sapo SKU', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      data: {
        id: 'product-1',
        variations: [
          {
            id: 'variant-1',
            product_id: 'product-1',
            variations_warehouses: [{ warehouse_id: 'warehouse-1' }],
          },
        ],
      },
    }, true, 201));

    await expect(createClient().createProductFromSapo({
      sku: 'FM-QSBL01-XA-L',
      name: 'Quần short',
      available: 91,
      retailPrice: 219000,
    })).resolves.toEqual({
      productId: 'product-1',
      variantId: 'variant-1',
      warehouseId: 'warehouse-1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://pos.pages.fm/api/v1/shops/shop-1/products?api_key=pancake-key',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: {
            name: 'Quần short',
            custom_id: 'FM-QSBL01-XA-L',
            variations: [
              {
                custom_id: 'FM-QSBL01-XA-L',
                is_edit_custom_id: true,
                barcode: 'FM-QSBL01-XA-L',
                retail_price: 219000,
              },
            ],
          },
        }),
      }),
    );
  });

  it('retries transient Pancake product create failures', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'temporary' }, false, 500))
      .mockResolvedValueOnce(jsonResponse({
        data: {
          id: 'product-1',
          variations: [
            {
              id: 'variant-1',
              product_id: 'product-1',
              variations_warehouses: [{ warehouse_id: 'warehouse-1' }],
            },
          ],
        },
      }, true, 201));

    await expect(createClient({
      'pancake.productRetryBackoffMs': '1',
    }).createProductFromSapo({
      sku: 'FM-QSBL01-XA-L',
      name: 'Quần short',
      available: 91,
      retailPrice: 219000,
    })).resolves.toEqual({
      productId: 'product-1',
      variantId: 'variant-1',
      warehouseId: 'warehouse-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws a clear error for non-2xx product responses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'Unauthorized' }, false, 401),
    );

    await expect(createClient().fetchProducts()).rejects.toThrow(
      'Pancake product fetch failed with status 401',
    );
  });

  it('updates a Pancake variation into a composite product', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    await createClient().updateCompositeProduct({
      comboVariantId: 'combo-variant-1',
      components: [
        { variationId: 'component-1', quantity: 1 },
        { variationId: 'component-2', quantity: 1 },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://pos.pages.fm/api/v1/shops/shop-1/variations/update_composite_product?api_key=pancake-key',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variation_id: 'combo-variant-1',
          composite_products: [
            { variation_id: 'component-1', quantity: 1 },
            { variation_id: 'component-2', quantity: 1 },
          ],
        }),
      }),
    );
  });

  it('throws a clear error when composite product update fails', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'Invalid composite' }, false, 422),
    );

    await expect(
      createClient().updateCompositeProduct({
        comboVariantId: 'combo-variant-1',
        components: [{ variationId: 'component-1', quantity: 1 }],
      }),
    ).rejects.toThrow('Pancake composite product update failed with status 422');
  });

  it('fetches Pancake provinces, districts, and communes with api key', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 1, name: 'Ho Chi Minh' }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 688, name: 'Hoc Mon' }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 12345, name: 'Xuan Thoi Thuong' }] }));

    const client = createClient();

    await expect(client.fetchProvinces()).resolves.toEqual([
      { id: 1, name: 'Ho Chi Minh' },
    ]);
    await expect(client.fetchDistrictsByProvinceId(1)).resolves.toEqual([
      { id: 688, name: 'Hoc Mon' },
    ]);
    await expect(client.fetchCommunesByDistrictId(688)).resolves.toEqual([
      { id: 12345, name: 'Xuan Thoi Thuong' },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://pos.pages.fm/api/v1/geo/provinces?api_key=pancake-key',
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://pos.pages.fm/api/v1/geo/districts?province_id=1&api_key=pancake-key',
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://pos.pages.fm/api/v1/geo/communes?district_id=688&api_key=pancake-key',
    );
  });

  it('creates, updates, fetches, and lists Pancake orders using shop scoped endpoints', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'pancake-order-1' } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'pancake-order-1', status: 1 } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'pancake-order-1' } }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'pancake-order-1' }] }));

    const client = createClient();
    const payload = {
      bill_full_name: 'Nguyen Van A',
      bill_phone_number: '0909000000',
      items: [{ product_id: 'product-1', variation_id: 'variant-1', quantity: 2 }],
      status: 0,
      warehouse_id: 'warehouse-1',
    };

    await expect(client.createOrder(payload)).resolves.toEqual({
      data: { id: 'pancake-order-1' },
    });
    await expect(client.updateOrder('pancake-order-1', { ...payload, status: 1 })).resolves.toEqual({
      data: { id: 'pancake-order-1', status: 1 },
    });
    await expect(client.fetchOrder('pancake-order-1')).resolves.toEqual({
      data: { id: 'pancake-order-1' },
    });
    await expect(client.fetchOrders({ pageSize: 50, pageNumber: 2 })).resolves.toEqual({
      data: [{ id: 'pancake-order-1' }],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://pos.pages.fm/api/v1/shops/shop-1/orders?api_key=pancake-key',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://pos.pages.fm/api/v1/shops/shop-1/orders/pancake-order-1?api_key=pancake-key',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, status: 1 }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://pos.pages.fm/api/v1/shops/shop-1/orders/pancake-order-1?api_key=pancake-key',
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://pos.pages.fm/api/v1/shops/shop-1/orders?page_size=50&page_number=2&api_key=pancake-key',
    );
  });
});
