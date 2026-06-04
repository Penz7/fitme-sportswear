import { ConfigService } from '@nestjs/config';
import { SapoClient } from './sapo.client';
import { SapoSessionService } from './sapo-session.service';

describe('SapoClient', () => {
  const fetchWithSession = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  function createClient(overrides: Record<string, string | number | undefined> = {}) {
    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number | undefined> = {
          'sapo.locationId': '572310',
          'shipping.viettelPost.service': 'VSL7',
          'shipping.viettelPost.accountId': '604003_1',
          'shipping.package.weight': 300,
          'shipping.package.height': 10,
          'shipping.package.width': 10,
          'shipping.package.length': 10,
          ...overrides,
        };
        return values[key];
      }),
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          'sapo.baseUrl': 'https://fitme-sportswear.mysapogo.com',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const sessionService = {
      fetchWithSession,
    } as unknown as SapoSessionService;

    return new SapoClient(configService, sessionService);
  }

  function jsonResponse(body: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  }

  it('fetches paginated Sapo products and flattens product pages', async () => {
    fetchWithSession
      .mockResolvedValueOnce(
        jsonResponse({
          products: [{ id: 'p1', name: 'Shirt', variants: [] }],
          metadata: { total: 2 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          products: [{ id: 'p2', name: 'Shorts', variants: [] }],
          metadata: { total: 2 },
        }),
      );

    const products = await createClient().fetchProducts();

    expect(products).toEqual([
      { id: 'p1', name: 'Shirt', variants: [] },
      { id: 'p2', name: 'Shorts', variants: [] },
    ]);
    expect(fetchWithSession).toHaveBeenNthCalledWith(
      1,
      'https://fitme-sportswear.mysapogo.com/admin/products/search.json?page=1&limit=50',
    );
    expect(fetchWithSession).toHaveBeenNthCalledWith(
      2,
      'https://fitme-sportswear.mysapogo.com/admin/products/search.json?page=2&limit=50',
    );
  });

  it('stops pagination when a page returns no products', async () => {
    fetchWithSession.mockResolvedValueOnce(jsonResponse({ products: [] }));

    await expect(createClient().fetchProducts()).resolves.toEqual([]);
    expect(fetchWithSession).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error for non-2xx product responses', async () => {
    fetchWithSession.mockResolvedValueOnce(
      jsonResponse({ error: 'Unauthorized' }, false, 401),
    );

    await expect(createClient().fetchProducts()).rejects.toThrow(
      'Sapo product fetch failed with status 401',
    );
  });

  it('fetches a paginated Sapo order page', async () => {
    fetchWithSession.mockResolvedValueOnce(
      jsonResponse({
        orders: [{ id: 'sapo-order-1' }],
        metadata: { total: 10 },
      }),
    );

    await expect(
      createClient().fetchOrders({ page: 2, limit: 25 }),
    ).resolves.toEqual({
      orders: [{ id: 'sapo-order-1' }],
      metadata: { total: 10 },
    });
    expect(fetchWithSession).toHaveBeenCalledWith(
      'https://fitme-sportswear.mysapogo.com/admin/orders.json?page=2&limit=25',
    );
  });

  it('adds filters when fetching Sapo order pages', async () => {
    fetchWithSession.mockResolvedValueOnce(jsonResponse({ orders: [] }));

    await createClient().fetchOrders({
      page: 1,
      limit: 50,
      status: 'finalized',
      query: 'AUTO_PANCAKE_17976',
      createdOnMin: '2026-05-01T00:00:00.000Z',
      createdOnMax: '2026-05-30T23:59:59.000Z',
    });

    expect(fetchWithSession).toHaveBeenCalledWith(
      'https://fitme-sportswear.mysapogo.com/admin/orders.json?page=1&limit=50&status=finalized&query=AUTO_PANCAKE_17976&created_on_min=2026-05-01T00%3A00%3A00.000Z&created_on_max=2026-05-30T23%3A59%3A59.000Z',
    );
  });

  it('fetches Sapo logs with page and limit', async () => {
    fetchWithSession.mockResolvedValueOnce(
      jsonResponse({
        ids: [101],
        logs: [{ id: 101, uri: '/admin/orders/5001.json' }],
      }),
    );

    await expect(createClient().fetchLogs(1, 100)).resolves.toEqual({
      ids: [101],
      logs: [{ id: 101, uri: '/admin/orders/5001.json' }],
    });
    expect(fetchWithSession).toHaveBeenCalledWith(
      'https://fitme-sportswear.mysapogo.com/admin/logs.json?page=1&limit=100',
    );
  });

  it('searches active Sapo customers using the doSearch endpoint', async () => {
    fetchWithSession.mockResolvedValueOnce(
      jsonResponse({ customers: [{ id: 'customer-1' }] }),
    );

    await expect(
      createClient().fetchCustomers(1, 10, '0909000000'),
    ).resolves.toEqual({ customers: [{ id: 'customer-1' }] });
    expect(fetchWithSession).toHaveBeenCalledWith(
      'https://fitme-sportswear.mysapogo.com/admin/customers/doSearch.json?page=1&limit=10&query.contains=0909000000&statuses.in=active&condition_type=must',
    );
  });

  it('throws a clear error for non-2xx Sapo log responses', async () => {
    fetchWithSession.mockResolvedValueOnce(
      jsonResponse({ error: 'Forbidden' }, false, 403),
    );

    await expect(createClient().fetchLogs(1, 100)).rejects.toThrow(
      'Sapo logs fetch failed with status 403',
    );
  });

  it('creates and finalizes Sapo orders with the required location header', async () => {
    fetchWithSession
      .mockResolvedValueOnce(jsonResponse({ order: { id: 'sapo-order-1' } }))
      .mockResolvedValueOnce(jsonResponse({ order: { id: 'sapo-order-1' } }));

    const client = createClient();
    const created = await client.createOrder({
      order: {
        code: 'AUTO_PANCAKE_pancake-order-1',
        total: 300000,
      },
    });
    await client.finalizeOrder('sapo-order-1');

    expect(created).toEqual({ order: { id: 'sapo-order-1' } });
    expect(fetchWithSession).toHaveBeenNthCalledWith(
      1,
      'https://fitme-sportswear.mysapogo.com/admin/orders.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sapo-LocationId': '572310',
        },
        body: JSON.stringify({
          order: {
            code: 'AUTO_PANCAKE_pancake-order-1',
            total: 300000,
          },
        }),
      },
    );
    expect(fetchWithSession).toHaveBeenNthCalledWith(
      2,
      'https://fitme-sportswear.mysapogo.com/admin/orders/sapo-order-1/finalize.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sapo-LocationId': '572310',
        },
        body: '{}',
      },
    );
  });

  it('fetches and creates Sapo customers by phone number', async () => {
    fetchWithSession
      .mockResolvedValueOnce(jsonResponse({ customers: [{ id: 123 }] }))
      .mockResolvedValueOnce(jsonResponse({ customer: { id: 456 } }));

    const client = createClient();

    await expect(client.fetchCustomers(1, 1, '0909000000')).resolves.toEqual({
      customers: [{ id: 123 }],
    });
    await expect(
      client.createCustomer({
        customer: {
          phone_number: '0909000000',
          name: 'Nguyen Van A',
          addresses: [{ address1: 'Ho Chi Minh' }],
        },
      }),
    ).resolves.toEqual({ customer: { id: 456 } });

    expect(fetchWithSession).toHaveBeenNthCalledWith(
      1,
      'https://fitme-sportswear.mysapogo.com/admin/customers/doSearch.json?page=1&limit=1&query.contains=0909000000&statuses.in=active&condition_type=must',
    );
    expect(fetchWithSession).toHaveBeenNthCalledWith(
      2,
      'https://fitme-sportswear.mysapogo.com/admin/customers.json',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          customer: {
            phone_number: '0909000000',
            name: 'Nguyen Van A',
            addresses: [{ address1: 'Ho Chi Minh' }],
          },
        }),
      }),
    );
  });

  it('updates fulfillment and cancellation endpoints for a Sapo order', async () => {
    fetchWithSession
      .mockResolvedValueOnce(jsonResponse({ order: { id: 'sapo-order-1' } }))
      .mockResolvedValueOnce(jsonResponse({ fulfillment: { id: 'fulfillment-1' } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const client = createClient();

    await client.updateOrder('sapo-order-1', { order: { note: 'changed' } });
    await client.createFulfillment('sapo-order-1', {
      fulfillment: { fulfillment_line_items: [] },
    });
    await client.shipFulfillment('sapo-order-1', 'fulfillment-1');
    await client.cancelOrder('sapo-order-1');

    expect(fetchWithSession).toHaveBeenNthCalledWith(
      1,
      'https://fitme-sportswear.mysapogo.com/admin/orders/sapo-order-1.json',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(fetchWithSession).toHaveBeenNthCalledWith(
      2,
      'https://fitme-sportswear.mysapogo.com/admin/orders/sapo-order-1/fulfillments.json',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchWithSession).toHaveBeenNthCalledWith(
      3,
      'https://fitme-sportswear.mysapogo.com/admin/orders/sapo-order-1/fulfillments/fulfillment-1/ship.json',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchWithSession).toHaveBeenNthCalledWith(
      4,
      'https://fitme-sportswear.mysapogo.com/admin/orders/sapo-order-1/cancel.json',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fetches ViettelPost freight amount through Sapo shipping service', async () => {
    fetchWithSession.mockResolvedValueOnce(
      jsonResponse({ vtp_price: { money_total: 42000 } }),
    );

    const freightAmount = await createClient().getFreightAmount({
      senderProvinceId: 2,
      senderDistrictId: 55,
      receiverProvinceId: 1,
      receiverDistrictId: 688,
      codAmount: 300000,
      freightPayer: 'customer',
    });

    expect(freightAmount).toBe(42000);
    expect(fetchWithSession).toHaveBeenCalledWith(
      'https://fitme-sportswear.mysapogo.com/admin/shipping_services/v3/vtp/price.json?sender_province_id=2&sender_district_id=55&receiver_province_id=1&receiver_district_id=688&package_type=HH&package_height=10&package_width=10&package_length=10&package_value=0&cod_amount=300000&service_extra=&service=VSL7&package_weight=300&receiver_province_name=&receiver_district_name=&receiver_ward_name=&freight_payer=customer&shipping_account_id=604003_1',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Sapo-LocationId': '572310',
        },
      },
    );
  });

  it('uses configured Sapo location, ViettelPost service, account, and package defaults', async () => {
    fetchWithSession.mockResolvedValueOnce(
      jsonResponse({ vtp_price: { money_total: 42000 } }),
    );

    await createClient({
      'sapo.locationId': '999999',
      'shipping.viettelPost.service': 'VTP_CUSTOM',
      'shipping.viettelPost.accountId': 'ACCOUNT_CUSTOM',
      'shipping.package.weight': 550,
      'shipping.package.height': 20,
      'shipping.package.width': 30,
      'shipping.package.length': 40,
    }).getFreightAmount({
      senderProvinceId: 2,
      senderDistrictId: 55,
      receiverProvinceId: 1,
      receiverDistrictId: 688,
      codAmount: 300000,
      freightPayer: 'customer',
    });

    expect(fetchWithSession).toHaveBeenCalledWith(
      'https://fitme-sportswear.mysapogo.com/admin/shipping_services/v3/vtp/price.json?sender_province_id=2&sender_district_id=55&receiver_province_id=1&receiver_district_id=688&package_type=HH&package_height=20&package_width=30&package_length=40&package_value=0&cod_amount=300000&service_extra=&service=VTP_CUSTOM&package_weight=550&receiver_province_name=&receiver_district_name=&receiver_ward_name=&freight_payer=customer&shipping_account_id=ACCOUNT_CUSTOM',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Sapo-LocationId': '999999',
        },
      },
    );
  });

  it('fetches Sapo cities, districts, and wards through session client', async () => {
    fetchWithSession
      .mockResolvedValueOnce(jsonResponse({ cities: [{ id: 79, name: 'Ho Chi Minh' }] }))
      .mockResolvedValueOnce(jsonResponse({ districts: [{ id: 784, name: 'Hoc Mon' }] }))
      .mockResolvedValueOnce(jsonResponse({ wards: [{ id: 27523, name: 'Xuan Thoi Thuong' }] }));

    const client = createClient();

    await expect(client.fetchCities()).resolves.toEqual([
      { id: 79, name: 'Ho Chi Minh' },
    ]);
    await expect(client.fetchDistrictsByCityId(79)).resolves.toEqual([
      { id: 784, name: 'Hoc Mon' },
    ]);
    await expect(client.fetchWardsByDistrictId(784)).resolves.toEqual([
      { id: 27523, name: 'Xuan Thoi Thuong' },
    ]);
    expect(fetchWithSession).toHaveBeenNthCalledWith(
      1,
      'https://fitme-sportswear.mysapogo.com/admin/cities.json',
    );
    expect(fetchWithSession).toHaveBeenNthCalledWith(
      2,
      'https://fitme-sportswear.mysapogo.com/admin/countries/201/cities/79/districts.json',
    );
    expect(fetchWithSession).toHaveBeenNthCalledWith(
      3,
      'https://fitme-sportswear.mysapogo.com/admin/districts/784/wards.json',
    );
  });
});
