import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ShopifyProductResponse {
  id: string;
  title: string;
  variants: Array<{
    id: string;
    sku: string;
    title: string;
    available: number;
    inventoryQuantity: number;
    price: number;
  }>;
}

export interface ShopifyInventoryUpdateInput {
  variantId: string;
  available: number;
  retailPrice: number | null;
}

@Injectable()
export class ShopifyClient {
  constructor(private readonly configService: ConfigService) {}

  getBaseUrl() {
    return this.configService.getOrThrow<string>('shopify.baseUrl');
  }

  async fetchProducts(): Promise<ShopifyProductResponse[]> {
    return [];
  }

  async updateInventoryAndPrice(
    input: ShopifyInventoryUpdateInput,
  ): Promise<void> {
    void input;
  }
}
