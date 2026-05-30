import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SapoProductResponse {
  id: string;
  name: string;
  variants: Array<{
    id: string;
    sku: string;
    variantRetailPrice: number;
    inventories: Array<{
      available: number;
      onHand: number;
    }>;
  }>;
}

@Injectable()
export class SapoClient {
  constructor(private readonly configService: ConfigService) {}

  getBaseUrl() {
    return this.configService.getOrThrow<string>('sapo.baseUrl');
  }

  async fetchProducts(): Promise<SapoProductResponse[]> {
    return [];
  }
}
