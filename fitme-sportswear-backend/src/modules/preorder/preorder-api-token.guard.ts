import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class PreorderApiTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('sync.apiToken');
    if (!expected) {
      throw new UnauthorizedException('PreOrder API token is not configured');
    }
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization');
    const actual = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : request.header('x-sync-api-token')?.trim();
    if (actual !== expected) {
      throw new UnauthorizedException('Invalid PreOrder API token');
    }
    return true;
  }
}
