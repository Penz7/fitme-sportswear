import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncApiTokenGuard } from './sync-api-token.guard';

describe('SyncApiTokenGuard', () => {
  function createGuard(expectedToken: string | null = 'sync-token') {
    const configService = {
      get: jest.fn((key: string) =>
        key === 'sync.apiToken' ? (expectedToken ?? undefined) : undefined,
      ),
    } as unknown as ConfigService;

    return new SyncApiTokenGuard(configService);
  }

  function contextWithHeaders(headers: Record<string, string | undefined>): ExecutionContext {
    const request = {
      header: jest.fn((name: string) => headers[name.toLowerCase()]),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('accepts a valid bearer token', () => {
    const guard = createGuard();

    expect(
      guard.canActivate(
        contextWithHeaders({ authorization: 'Bearer sync-token' }),
      ),
    ).toBe(true);
  });

  it('accepts a valid x-sync-api-token header', () => {
    const guard = createGuard();

    expect(
      guard.canActivate(contextWithHeaders({ 'x-sync-api-token': 'sync-token' })),
    ).toBe(true);
  });

  it('rejects missing or invalid tokens', () => {
    const guard = createGuard();

    expect(() => guard.canActivate(contextWithHeaders({}))).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      guard.canActivate(contextWithHeaders({ authorization: 'Bearer wrong' })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects all requests when the expected token is not configured', () => {
    const guard = createGuard(null);

    expect(() =>
      guard.canActivate(contextWithHeaders({ authorization: 'Bearer sync-token' })),
    ).toThrow(UnauthorizedException);
  });
});
