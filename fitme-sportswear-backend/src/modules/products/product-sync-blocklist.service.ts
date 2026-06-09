import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeSku } from './sku-normalizer';

@Injectable()
export class ProductSyncBlocklistService {
  constructor(private readonly configService: ConfigService) {}

  load(): Set<string> {
    return new Set(
      [
        ...this.configStringList('sync.products.skuBlocklist'),
        ...this.configJsonStringList('sync.products.skuBlocklistFile'),
      ].map(normalizeSku),
    );
  }

  private configStringList(key: string): string[] {
    const value = this.configService.get<string[] | string | undefined>(key);
    if (Array.isArray(value)) {
      return value;
    }
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private configJsonStringList(key: string): string[] {
    const filePath = this.configService.get<string | undefined>(key);
    if (!filePath) {
      return [];
    }

    const resolvedPath = this.resolveConfiguredFilePath(filePath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Product sync SKU blocklist file not found: ${resolvedPath}`);
    }

    const parsed = JSON.parse(readFileSync(resolvedPath, 'utf8')) as unknown;
    const values = this.asStringArray(parsed)
      ? parsed
      : this.firstJsonStringArray(parsed, ['blockedSkus', 'skus', 'blocklist']);

    if (!values) {
      throw new Error(
        `Product sync SKU blocklist file must be a string array or contain blockedSkus: ${resolvedPath}`,
      );
    }

    return values.map((item) => item.trim()).filter(Boolean);
  }

  private resolveConfiguredFilePath(filePath: string): string {
    if (isAbsolute(filePath)) {
      return filePath;
    }

    const candidates = [
      resolve(process.cwd(), filePath),
      resolve(__dirname, '../../..', filePath),
    ];
    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
  }

  private firstJsonStringArray(value: unknown, keys: string[]): string[] | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const objectValue = value as Record<string, unknown>;
    for (const key of keys) {
      if (this.asStringArray(objectValue[key])) {
        return objectValue[key];
      }
    }
    return null;
  }

  private asStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
  }
}
