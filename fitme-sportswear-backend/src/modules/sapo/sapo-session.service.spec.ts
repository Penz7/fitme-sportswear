import { ConfigService } from '@nestjs/config';
import { SapoSessionService } from './sapo-session.service';

describe('SapoSessionService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
  });

  function createService(overrides: Record<string, string | number | undefined> = {}) {
    const values: Record<string, string | number | undefined> = {
      'sapo.accountBaseUrl': 'https://accounts.sapo.vn',
      'sapo.baseUrl': 'https://fitme-sportswear.mysapogo.com',
      'sapo.phoneNumber': '901234567',
      'sapo.password': 'secret',
      'sapo.clientId': 'sapo-client',
      'sapo.shopDomain': 'fitme-sportswear.mysapogo.com',
      'sapo.loginCooldownMs': 30 * 60 * 1000,
      ...overrides,
    };

    const configService = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    return new SapoSessionService(configService);
  }

  function response(
    ok: boolean,
    status: number,
    setCookie?: string[],
    body?: unknown,
  ) {
    return {
      ok,
      status,
      headers: {
        getSetCookie: () => setCookie ?? [],
        get: (name: string) =>
          name.toLowerCase() === 'set-cookie'
            ? (setCookie?.join(', ') ?? null)
            : name.toLowerCase() === 'content-type' && body !== undefined
              ? 'application/json'
              : null,
      },
      json: async () => body,
      text: async () => 'response body',
    } as unknown as Response;
  }

  it('builds the login form and stores cookies from all login steps', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(true, 200, ['session_id=abc; Path=/'], {
          redirect: 'https://accounts.sapo.vn/sso?serviceType=pos',
        }),
      )
      .mockResolvedValueOnce(response(true, 200, ['sso_id=def; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['oauth_id=ghi; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['admin_id=jkl; Path=/']));

    const service = createService();

    await service.ensureSession();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://accounts.sapo.vn/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      }),
    );

    const firstBody = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(firstBody.get('phoneNumber')).toBe('901234567');
    expect(firstBody.get('password')).toBe('secret');
    expect(firstBody.get('clientId')).toBe('sapo-client');
    expect(firstBody.get('countryCode')).toBe('84');
    expect(firstBody.get('Product')).toBe('pos');
    expect(firstBody.get('suffix-domain')).toBe('mysapogo.com');

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://accounts.sapo.vn/sso?serviceType=pos',
      expect.objectContaining({ method: 'GET' }),
    );

    const authorizeUrl = new URL(fetchMock.mock.calls[2][0]);
    expect(authorizeUrl.searchParams.get('client_id')).toBe('sapo-client');
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(
      'https://app.sapo.vn/oauth/SapoSSOOauthCallback',
    );
    expect(authorizeUrl.searchParams.get('state')).toBe(
      '{"redirectUrl" : "http://fitme-sportswear.mysapogo.com/admin/authorization/login?returnUrl=/"}',
    );

    expect(service.getCookieHeader()).toBe(
      'session_id=abc; sso_id=def; oauth_id=ghi; admin_id=jkl',
    );
  });

  it('refreshes the session and retries a request once after 401', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(true, 200, ['session_id=old; Path=/'], {
          redirect: 'https://accounts.sapo.vn/sso?serviceType=pos',
        }),
      )
      .mockResolvedValueOnce(response(true, 200, ['sso_id=old; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['oauth_id=old; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['admin_id=old; Path=/']))
      .mockResolvedValueOnce(response(false, 401))
      .mockResolvedValueOnce(
        response(true, 200, ['session_id=new; Path=/'], {
          redirect: 'https://accounts.sapo.vn/sso?serviceType=pos',
        }),
      )
      .mockResolvedValueOnce(response(true, 200, ['sso_id=new; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['oauth_id=new; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['admin_id=new; Path=/']))
      .mockResolvedValueOnce(response(true, 200));

    const service = createService();

    const result = await service.fetchWithSession(
      'https://fitme-sportswear.mysapogo.com/admin/products/search.json?page=1&limit=50',
    );

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://fitme-sportswear.mysapogo.com/admin/products/search.json?page=1&limit=50',
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: 'session_id=new; sso_id=new; oauth_id=new; admin_id=new',
        }),
      }),
    );
  });

  it('reuses cached session cookies without logging in again', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(true, 200, ['session_id=old; Path=/'], {
          redirect: 'https://accounts.sapo.vn/sso?serviceType=pos',
        }),
      )
      .mockResolvedValueOnce(response(true, 200, ['sso_id=old; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['oauth_id=old; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['admin_id=old; Path=/']))
      .mockResolvedValueOnce(response(true, 200))
      .mockResolvedValueOnce(response(true, 200));

    const service = createService();

    await service.fetchWithSession(
      'https://fitme-sportswear.mysapogo.com/admin/orders.json?page=1&limit=20',
    );
    await service.fetchWithSession(
      'https://fitme-sportswear.mysapogo.com/admin/products/search.json?page=1&limit=50',
    );

    const loginCalls = fetchMock.mock.calls.filter(
      ([url]) => url === 'https://accounts.sapo.vn/login',
    );
    expect(loginCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://fitme-sportswear.mysapogo.com/admin/products/search.json?page=1&limit=50',
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: 'session_id=old; sso_id=old; oauth_id=old; admin_id=old',
        }),
      }),
    );
  });

  it('throws a clear error when login fails', async () => {
    fetchMock.mockResolvedValueOnce(response(false, 403));

    const service = createService();

    await expect(service.ensureSession()).rejects.toThrow(
      'Sapo login failed with status 403',
    );
  });

  it('does not call Sapo login again while login is cooling down after 403', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-19T03:00:00.000Z'));
    fetchMock.mockResolvedValueOnce(response(false, 403));

    const service = createService({ 'sapo.loginCooldownMs': 30 * 60 * 1000 });

    await expect(service.ensureSession()).rejects.toThrow(
      'Sapo login failed with status 403',
    );
    await expect(service.ensureSession()).rejects.toThrow(
      'Sapo login temporarily blocked until 2026-06-19T03:30:00.000Z',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
