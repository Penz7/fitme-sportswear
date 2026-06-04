import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SapoSessionService {
  private readonly cookies = new Map<string, string>();
  private loginPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async ensureSession(): Promise<void> {
    if (this.cookies.size > 0) {
      return;
    }

    await this.refreshSession();
  }

  async refreshSession(): Promise<void> {
    if (!this.loginPromise) {
      this.loginPromise = this.login().finally(() => {
        this.loginPromise = null;
      });
    }

    await this.loginPromise;
  }

  getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  async fetchWithSession(
    input: string,
    init: RequestInit = {},
    attempts = 3,
  ): Promise<Response> {
    await this.ensureSession();

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const response = await fetch(input, {
        ...init,
        headers: {
          ...this.toHeaderObject(init.headers),
          Cookie: this.getCookieHeader(),
        },
      });

      this.storeCookies(response);

      if (response.status !== 401 || attempt === attempts) {
        return response;
      }

      this.cookies.clear();
      await this.refreshSession();
    }

    throw new Error('Sapo request failed after session refresh attempts');
  }

  private async login(): Promise<void> {
    this.cookies.clear();

    const accountBaseUrl = this.requiredConfig('sapo.accountBaseUrl');
    const sapoBaseUrl = this.requiredConfig('sapo.baseUrl');
    const clientId = this.requiredConfig('sapo.clientId');
    const shopDomain = this.requiredConfig('sapo.shopDomain');

    const loginBody = new URLSearchParams({
      phoneNumber: this.requiredConfig('sapo.phoneNumber'),
      password: this.requiredConfig('sapo.password'),
      clientId,
      countryCode: '84',
      isFixedDomain: 'false',
      Product: 'pos',
      'suffix-domain': 'mysapogo.com',
    });

    await this.fetchLoginStep(
      `${accountBaseUrl}/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: loginBody,
      },
      'Sapo login',
    );

    const authorizeUrl = new URL(`${accountBaseUrl}/oauth/authorize`);
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set(
      'redirect_uri',
      'https://app.sapo.vn/oauth/SapoSSOOauthCallback',
    );
    authorizeUrl.searchParams.set(
      'state',
      `{"redirectUrl" : "http://${shopDomain}/admin/authorization/login?returnUrl=/"}`,
    );
    authorizeUrl.searchParams.set('scope', 'profile');
    authorizeUrl.searchParams.set('response_type', 'code');

    await this.fetchLoginStep(
      authorizeUrl.toString(),
      {
        method: 'GET',
        headers: {
          Cookie: this.getCookieHeader(),
          Referer: `${sapoBaseUrl}/`,
        },
      },
      'Sapo authorize',
    );

    await this.fetchLoginStep(
      `${sapoBaseUrl}/admin/authorization/login?returnUrl=/admin`,
      {
        method: 'GET',
        headers: {
          Cookie: this.getCookieHeader(),
          Referer: `${sapoBaseUrl}/`,
        },
      },
      'Sapo admin authorization',
    );
  }

  private async fetchLoginStep(
    url: string,
    init: RequestInit,
    label: string,
  ): Promise<void> {
    const response = await this.fetchFollowingRedirects(url, init);

    if (!response.ok) {
      throw new Error(`${label} failed with status ${response.status}`);
    }
  }

  private async fetchFollowingRedirects(
    url: string,
    init: RequestInit,
    maxRedirects = 10,
  ): Promise<Response> {
    let currentUrl = url;
    let currentInit: RequestInit = init;

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      const response = await fetch(currentUrl, {
        ...currentInit,
        redirect: 'manual',
        headers: {
          ...this.toHeaderObject(currentInit.headers),
          Cookie: this.getCookieHeader(),
        },
      });

      this.storeCookies(response);

      if (!this.isRedirect(response.status)) {
        return response;
      }

      const location = response.headers.get('location');
      if (!location) {
        return response;
      }

      currentUrl = new URL(location, currentUrl).toString();
      currentInit = this.redirectInit(currentInit, response.status);
    }

    throw new Error('Sapo login redirect limit exceeded');
  }

  private isRedirect(status: number): boolean {
    return [301, 302, 303, 307, 308].includes(status);
  }

  private redirectInit(init: RequestInit, status: number): RequestInit {
    const method = init.method?.toUpperCase() ?? 'GET';
    const shouldSwitchToGet =
      status === 303 || ((status === 301 || status === 302) && method !== 'GET' && method !== 'HEAD');

    if (!shouldSwitchToGet) {
      return init;
    }

    const { body: _body, ...rest } = init;
    return {
      ...rest,
      method: 'GET',
    };
  }

  private storeCookies(response: Response): void {
    const headers = response.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const setCookieHeaders =
      headers.getSetCookie?.() ??
      this.splitSetCookieHeader(headers.get('set-cookie'));

    for (const cookieHeader of setCookieHeaders) {
      const [pair] = cookieHeader.split(';');
      const separator = pair.indexOf('=');

      if (separator <= 0) {
        continue;
      }

      this.cookies.set(
        pair.slice(0, separator).trim(),
        pair.slice(separator + 1).trim(),
      );
    }
  }

  private splitSetCookieHeader(header: string | null): string[] {
    if (!header) {
      return [];
    }

    return header.split(/,(?=\s*[^;]+=)/).map((value) => value.trim());
  }

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new Error(`Missing required Sapo config: ${key}`);
    }

    return value;
  }

  private toHeaderObject(
    headers: HeadersInit | undefined,
  ): Record<string, string> {
    if (!headers) {
      return {};
    }

    if (headers instanceof Headers) {
      return Object.fromEntries(headers.entries());
    }

    if (Array.isArray(headers)) {
      return Object.fromEntries(headers);
    }

    return headers;
  }
}
