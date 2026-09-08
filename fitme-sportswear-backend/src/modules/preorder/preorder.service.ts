import { Injectable } from '@nestjs/common';
import { PreorderLineStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface PreorderAvailabilityInput {
  allowPreorder: boolean;
  preorderLimit: number | null;
  preorderPendingQty: number;
  sapoStock: number;
}

export interface PreorderAvailability {
  availableForNewSale: number;
  preorderRemainingQty: number | null;
  mode: 'BUY_NOW' | 'PREORDER' | 'SOLD_OUT';
}

export interface ShopifyPreorderLine {
  sku?: string | null;
  variant_id?: string | number | null;
  quantity?: string | number | null;
}

export interface MatchedPreorderLine {
  sku: string;
  quantity: number;
  preorderSkuId: string;
}

export interface ShopifyPreorderInventory {
  managed: boolean;
  enabled: boolean;
  available: number;
  inventoryPolicy: 'deny' | 'continue';
  mode: PreorderAvailability['mode'];
  expectedRestockDate: Date | null;
}

export interface PreorderPaymentReservation {
  accepted: boolean;
  lines: MatchedPreorderLine[];
  exceededSkus: string[];
}

@Injectable()
export class PreorderService {
  constructor(private readonly prisma: PrismaService) {}

  evaluateAvailability(input: PreorderAvailabilityInput): PreorderAvailability {
    const sapoStock = Math.max(0, input.sapoStock);
    const pendingQty = Math.max(0, input.preorderPendingQty);
    const availableForNewSale = sapoStock - pendingQty;
    const preorderRemainingQty =
      input.preorderLimit === null
        ? null
        : Math.max(0, input.preorderLimit - pendingQty);

    if (availableForNewSale > 0) {
      return { availableForNewSale, preorderRemainingQty, mode: 'BUY_NOW' };
    }

    if (
      input.allowPreorder &&
      (preorderRemainingQty === null || preorderRemainingQty > 0)
    ) {
      return { availableForNewSale, preorderRemainingQty, mode: 'PREORDER' };
    }

    return { availableForNewSale, preorderRemainingQty, mode: 'SOLD_OUT' };
  }

  async findShopifyPreorderLines(
    lines: ShopifyPreorderLine[],
  ): Promise<MatchedPreorderLine[]> {
    const skus = lines
      .map((line) => this.normalizedSku(line.sku))
      .filter((sku): sku is string => Boolean(sku));
    const variantIds = lines
      .map((line) => this.stringValue(line.variant_id))
      .filter((variantId): variantId is string => Boolean(variantId));

    if (skus.length === 0 && variantIds.length === 0) {
      return [];
    }

    const configured = await this.prisma.preorderSku.findMany({
      where: {
        allowPreorder: true,
        OR: [
          ...(skus.length > 0 ? [{ sku: { in: skus } }] : []),
          ...(variantIds.length > 0
            ? [{ shopifyVariantId: { in: variantIds } }]
            : []),
        ],
      },
    });
    const bySku = new Map(configured.map((item) => [item.sku, item]));
    const byVariantId = new Map(
      configured
        .filter((item) => item.shopifyVariantId)
        .map((item) => [item.shopifyVariantId as string, item]),
    );

    return lines.flatMap((line) => {
      const sku = this.normalizedSku(line.sku);
      const configuredSku =
        (sku ? bySku.get(sku) : undefined) ??
        byVariantId.get(this.stringValue(line.variant_id) ?? '');
      const quantity = this.positiveInteger(line.quantity);
      if (!configuredSku || !sku || quantity === 0) {
        return [];
      }
      return [{ sku, quantity, preorderSkuId: configuredSku.id }];
    });
  }

  async recordShopifyOrder(
    shopifyOrderId: string,
    sapoOrderId: string | null,
    lines: ShopifyPreorderLine[],
    paymentConfirmed: boolean,
  ): Promise<MatchedPreorderLine[]> {
    const matched = await this.findShopifyPreorderLines(lines);
    for (const line of matched) {
      await this.prisma.preorderLine.upsert({
        where: {
          shopifyOrderId_sku: { shopifyOrderId, sku: line.sku },
        },
        create: {
          preorderSkuId: line.preorderSkuId,
          shopifyOrderId,
          sapoOrderId,
          sku: line.sku,
          quantity: line.quantity,
          ...(paymentConfirmed ? { paymentConfirmedAt: new Date() } : {}),
        },
        update: {
          sapoOrderId,
          ...(paymentConfirmed ? { paymentConfirmedAt: new Date() } : {}),
        },
      });
    }
    return matched;
  }

  /**
   * Converts a pending Shopify PreOrder into a paid reservation.  The quota
   * check and the write happen in the same serializable transaction, so two
   * simultaneous "Mark as paid" events cannot both consume the final slot.
   */
  async confirmShopifyPayment(
    shopifyOrderId: string,
    lines: ShopifyPreorderLine[],
  ): Promise<PreorderPaymentReservation> {
    const matched = await this.findShopifyPreorderLines(lines);
    if (matched.length === 0) {
      return { accepted: true, lines: [], exceededSkus: [] };
    }

    return this.prisma.$transaction(
      async (tx) => {
        const unique = [...new Map(matched.map((line) => [line.preorderSkuId, line])).values()]
          .sort((left, right) => left.preorderSkuId.localeCompare(right.preorderSkuId));

        // Row locks are deliberately acquired in a stable order to avoid a
        // deadlock when a cart contains more than one PreOrder SKU.
        for (const line of unique) {
          await tx.$queryRaw`
            SELECT id FROM "preorder_skus" WHERE id = ${line.preorderSkuId} FOR UPDATE
          `;
        }

        const exceededSkus: string[] = [];
        for (const line of matched) {
          const current = await tx.preorderLine.findUnique({
            where: { shopifyOrderId_sku: { shopifyOrderId, sku: line.sku } },
          });
          if (current?.paymentConfirmedAt) {
            continue;
          }

          const configured = await tx.preorderSku.findUniqueOrThrow({
            where: { id: line.preorderSkuId },
          });
          if (configured.preorderLimit === null) {
            continue;
          }
          const reserved = await tx.preorderLine.aggregate({
            where: {
              preorderSkuId: line.preorderSkuId,
              paymentConfirmedAt: { not: null },
              status: {
                in: [
                  PreorderLineStatus.PENDING,
                  PreorderLineStatus.ALLOCATED,
                  PreorderLineStatus.READY_TO_FULFILL,
                ],
              },
            },
            _sum: { quantity: true },
          });
          if ((reserved._sum.quantity ?? 0) + line.quantity > configured.preorderLimit) {
            exceededSkus.push(line.sku);
          }
        }

        if (exceededSkus.length > 0) {
          return { accepted: false, lines: matched, exceededSkus };
        }

        for (const line of matched) {
          await tx.preorderLine.upsert({
            where: { shopifyOrderId_sku: { shopifyOrderId, sku: line.sku } },
            create: {
              preorderSkuId: line.preorderSkuId,
              shopifyOrderId,
              sku: line.sku,
              quantity: line.quantity,
              paymentConfirmedAt: new Date(),
            },
            update: { paymentConfirmedAt: new Date() },
          });
        }

        return { accepted: true, lines: matched, exceededSkus: [] };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async isSapoOrderReadyForFulfillment(sapoOrderId: string): Promise<boolean> {
    const blocked = await this.prisma.preorderLine.count({
      where: {
        sapoOrderId,
        OR: [
          { status: { in: [PreorderLineStatus.PENDING, PreorderLineStatus.ALLOCATED] } },
          { paymentConfirmedAt: null },
        ],
      },
    });
    return blocked === 0;
  }

  async cancelShopifyOrder(shopifyOrderId: string): Promise<void> {
    await this.prisma.preorderLine.updateMany({
      where: {
        shopifyOrderId,
        status: {
          in: [
            PreorderLineStatus.PENDING,
            PreorderLineStatus.ALLOCATED,
            PreorderLineStatus.READY_TO_FULFILL,
          ],
        },
      },
      data: { status: PreorderLineStatus.CANCELLED },
    });
  }

  async pendingQuantity(sku: string): Promise<number> {
    const total = await this.prisma.preorderLine.aggregate({
      where: {
        sku,
        paymentConfirmedAt: { not: null },
        status: {
          in: [
            PreorderLineStatus.PENDING,
            PreorderLineStatus.ALLOCATED,
            PreorderLineStatus.READY_TO_FULFILL,
          ],
        },
      },
      _sum: { quantity: true },
    });
    return total._sum.quantity ?? 0;
  }

  async allocateSapoStock(sku: string, sapoStock: number): Promise<void> {
    const reserved = await this.prisma.preorderLine.aggregate({
      where: {
        sku,
        paymentConfirmedAt: { not: null },
        status: {
          in: [
            PreorderLineStatus.ALLOCATED,
            PreorderLineStatus.READY_TO_FULFILL,
          ],
        },
      },
      _sum: { allocatedQty: true },
    });
    let remainingStock = Math.max(
      0,
      Math.trunc(sapoStock) - (reserved._sum.allocatedQty ?? 0),
    );
    if (remainingStock === 0) {
      return;
    }

    const waiting = await this.prisma.preorderLine.findMany({
      where: {
        sku,
        paymentConfirmedAt: { not: null },
        status: { in: [PreorderLineStatus.PENDING, PreorderLineStatus.ALLOCATED] },
      },
      // A line becomes eligible only once paid. Payment time is therefore the
      // primary FIFO key; creation time is solely a deterministic tie-breaker.
      orderBy: [{ paymentConfirmedAt: 'asc' }, { createdAt: 'asc' }],
    });
    for (const line of waiting) {
      if (remainingStock === 0) {
        break;
      }
      const outstanding = Math.max(0, line.quantity - line.allocatedQty);
      const allocation = Math.min(remainingStock, outstanding);
      if (allocation === 0) {
        continue;
      }
      const allocatedQty = line.allocatedQty + allocation;
      await this.prisma.preorderLine.update({
        where: { id: line.id },
        data: {
          allocatedQty,
          status:
            allocatedQty === line.quantity
              ? PreorderLineStatus.READY_TO_FULFILL
              : PreorderLineStatus.ALLOCATED,
        },
      });
      remainingStock -= allocation;
    }
  }

  async markSapoOrderFulfilled(sapoOrderId: string): Promise<void> {
    await this.prisma.preorderLine.updateMany({
      where: { sapoOrderId, status: PreorderLineStatus.READY_TO_FULFILL },
      data: { status: PreorderLineStatus.FULFILLED },
    });
  }

  async shopifyInventory(
    sku: string,
    sapoStock: number,
  ): Promise<ShopifyPreorderInventory> {
    const configured = await this.prisma.preorderSku.findUnique({
      where: { sku },
    });
    if (!configured?.allowPreorder) {
      return {
        managed: Boolean(configured),
        enabled: false,
        available: Math.max(0, Math.trunc(sapoStock)),
        inventoryPolicy: 'deny',
        mode: sapoStock > 0 ? 'BUY_NOW' : 'SOLD_OUT',
        expectedRestockDate: null,
      };
    }

    await this.allocateSapoStock(sku, sapoStock);
    const pendingQty = await this.pendingQuantity(sku);
    const availability = this.evaluateAvailability({
      allowPreorder: true,
      preorderLimit: configured.preorderLimit,
      preorderPendingQty: pendingQty,
      sapoStock,
    });
    return {
      managed: true,
      enabled: true,
      available:
        availability.mode === 'BUY_NOW'
          ? Math.max(0, availability.availableForNewSale)
          : availability.preorderRemainingQty ?? 0,
      // Shopify needs either a positive inventory quantity or its native
      // continue-selling policy to accept an order. For an intentionally
      // unlimited preorder we use the latter only while the SKU is in the
      // PREORDER state; normal stock sales remain inventory-limited.
      inventoryPolicy:
        configured.preorderLimit === null && availability.mode === 'PREORDER'
          ? 'continue'
          : 'deny',
      mode: availability.mode,
      expectedRestockDate: configured.expectedRestockDate ?? null,
    };
  }

  preorderNote(lines: MatchedPreorderLine[]): string | null {
    if (lines.length === 0) {
      return null;
    }
    const skus = lines.map((line) => `${line.sku} x${line.quantity}`).join(', ');
    return `[PREORDER - CHỜ HÀNG] ${skus}. Không tạo vận đơn/giao vận chuyển cho đến khi đã phân bổ hàng.`;
  }

  private normalizedSku(value: string | null | undefined): string | null {
    const normalized = String(value ?? '').trim().toUpperCase();
    return normalized || null;
  }

  private stringValue(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }

  private positiveInteger(value: unknown): number {
    const quantity = Number(value);
    return Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
  }
}
