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
      'https://pos.pages.fm/api/v1/shops/shop-1/products/variations?page_size=100&page_number=1&api_key=pancake-key',
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://pos.pages.fm/api/v1/shops/shop-1/products/variations?page_size=100&page_number=2&api_key=pancake-key',
    );
  });

  it('stops pagination when data is empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], total_pages: 5 }));

    const products = await createClient().fetchProducts();

    expect(products).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('normalizes snake_case variation fields returned by Pancake', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            id: 'v1',
            display_id: 'SKU-1',
            product_id: 'p1',
            product: { name: 'Shirt' },
            retail_price: 100000,
            variations_warehouses: [
              {
                warehouse_id: 'warehouse-1',
                remain_quantity: 12,
                actual_remain_quantity: 15,
              },
            ],
          },
        ],
        total_pages: 1,
      }),
    );

    await expect(createClient().fetchProducts()).resolves.toEqual([
      {
        id: 'v1',
        displayId: 'SKU-1',
        productId: 'p1',
        product: { name: 'Shirt' },
        retailPrice: 100000,
        variationsWarehouses: [
          {
            warehouseId: 'warehouse-1',
            remainQuantity: 12,
            actualRemainQuantity: 15,
          },
        ],
      },
    ]);
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
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variations_warehouses: [
            { warehouse_id: 'warehouse-1', remain_quantity: 12 },
          ],
        }),
      },
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

  it('throws a clear error for non-2xx product responses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'Unauthorized' }, false, 401),
    );

    await expect(createClient().fetchProducts()).rejects.toThrow(
      'Pancake product fetch failed with status 401',
    );
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

  it('normalizes string address IDs returned by Pancake to numbers', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [{ id: '701', name: 'Ho Chi Minh' }] }),
    );

    await expect(createClient().fetchProvinces()).resolves.toEqual([
      { id: 701, name: 'Ho Chi Minh' },
    ]);
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
