import { ConfigService } from '@nestjs/config';
import { SapoSessionService } from './sapo-session.service';

describe('SapoSessionService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
  });

  function createService(overrides: Record<string, string | undefined> = {}) {
    const values: Record<string, string | undefined> = {
      'sapo.accountBaseUrl': 'https://accounts.sapo.vn',
      'sapo.baseUrl': 'https://fitme-sportswear.mysapogo.com',
      'sapo.phoneNumber': '901234567',
      'sapo.password': 'secret',
      'sapo.clientId': 'sapo-client',
      'sapo.shopDomain': 'fitme-sportswear.mysapogo.com',
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
    location?: string,
  ) {
    return {
      ok,
      status,
      headers: {
        getSetCookie: () => setCookie ?? [],
        get: (name: string) => {
          if (name.toLowerCase() === 'set-cookie') {
            return setCookie?.join(', ') ?? null;
          }

          if (name.toLowerCase() === 'location') {
            return location ?? null;
          }

          return null;
        },
      },
      text: async () => 'response body',
    } as unknown as Response;
  }

  it('builds the login form and stores cookies from all login steps', async () => {
    fetchMock
      .mockResolvedValueOnce(response(true, 200, ['session_id=abc; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['oauth_id=def; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['admin_id=ghi; Path=/']));

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
    const authorizeUrl = new URL(fetchMock.mock.calls[1][0]);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      'https://accounts.sapo.vn/oauth/authorize',
    );
    expect(authorizeUrl.searchParams.get('client_id')).toBe('sapo-client');
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(
      'https://app.sapo.vn/oauth/SapoSSOOauthCallback',
    );
    expect(authorizeUrl.searchParams.get('state')).toBe(
      '{"redirectUrl" : "http://fitme-sportswear.mysapogo.com/admin/authorization/login?returnUrl=/"}',
    );
    expect(service.getCookieHeader()).toBe(
      'session_id=abc; oauth_id=def; admin_id=ghi',
    );
  });

  it('stores cookies from Sapo login redirects', async () => {
    fetchMock
      .mockResolvedValueOnce(response(true, 200, ['session_id=abc; Path=/']))
      .mockResolvedValueOnce(
        response(
          false,
          302,
          ['oauth_id=def; Path=/'],
          'https://fitme-sportswear.mysapogo.com/admin',
        ),
      )
      .mockResolvedValueOnce(response(true, 200, ['shop_id=ghi; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['admin_id=jkl; Path=/']));

    const service = createService();

    await service.ensureSession();

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://fitme-sportswear.mysapogo.com/admin',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Cookie: 'session_id=abc; oauth_id=def',
        }),
        redirect: 'manual',
      }),
    );
    expect(service.getCookieHeader()).toBe(
      'session_id=abc; oauth_id=def; shop_id=ghi; admin_id=jkl',
    );
  });

  it('refreshes the session and retries a request once after 401', async () => {
    fetchMock
      .mockResolvedValueOnce(response(true, 200, ['session_id=old; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['oauth_id=old; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['admin_id=old; Path=/']))
      .mockResolvedValueOnce(response(false, 401))
      .mockResolvedValueOnce(response(true, 200, ['session_id=new; Path=/']))
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
          Cookie: 'session_id=new; oauth_id=new; admin_id=new',
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
});
