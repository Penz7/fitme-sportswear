import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PancakeProductResponse {
  displayId: string;
  productId: string;
  id: string;
  product: {
    name: string;
  };
  retailPrice: number;
  variationsWarehouses: Array<{
    warehouseId: string;
    remainQuantity: number;
    actualRemainQuantity: number;
  }>;
}

export interface PancakeInventoryUpdateInput {
  variantId: string;
  warehouseId: string | null;
  available: number;
}

@Injectable()
export class PancakeClient {
  constructor(private readonly configService: ConfigService) {}

  getBaseUrl() {
    return this.configService.getOrThrow<string>('pancake.baseUrl');
  }

  async fetchProducts(): Promise<PancakeProductResponse[]> {
    return [];
  }

  async updateInventory(input: PancakeInventoryUpdateInput): Promise<void> {
    void input;
  }
}
