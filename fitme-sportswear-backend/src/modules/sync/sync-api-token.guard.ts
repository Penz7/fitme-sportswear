import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class SyncApiTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const token = this.configService.get<string>('sync.apiToken');

    if (token === undefined || token === null || token === '') {
      throw new UnauthorizedException('Sync API token is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedToken = this.resolveToken(request);

    if (providedToken !== token) {
      throw new UnauthorizedException('Invalid sync API token');
    }

    return true;
  }

  private resolveToken(request: Request): string | undefined {
    const authorization = request.header('authorization');
    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice('Bearer '.length).trim();
    }

    return request.header('x-sync-api-token')?.trim();
  }
}
