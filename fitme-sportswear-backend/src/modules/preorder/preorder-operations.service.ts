import { Injectable } from '@nestjs/common';
import { PreorderLineStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PreorderOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [skus, grouped] = await Promise.all([
      this.prisma.preorderSku.findMany({ orderBy: { sku: 'asc' } }),
      this.prisma.preorderLine.groupBy({
        by: ['preorderSkuId', 'status'],
        where: { paymentConfirmedAt: { not: null } },
        _sum: { quantity: true, allocatedQty: true },
      }),
    ]);
    const totals = new Map<string, Record<string, { quantity: number; allocated: number }>>();
    for (const row of grouped) {
      const byStatus = totals.get(row.preorderSkuId) ?? {};
      byStatus[row.status] = {
        quantity: row._sum.quantity ?? 0,
        allocated: row._sum.allocatedQty ?? 0,
      };
      totals.set(row.preorderSkuId, byStatus);
    }

    const products = skus.map((sku) => {
      const states = totals.get(sku.id) ?? {};
      const waiting =
        (states[PreorderLineStatus.PENDING]?.quantity ?? 0) +
        (states[PreorderLineStatus.ALLOCATED]?.quantity ?? 0);
      const ready = states[PreorderLineStatus.READY_TO_FULFILL]?.quantity ?? 0;
      const reserved = waiting + ready;
      return {
        sku: sku.sku,
        enabled: sku.allowPreorder,
        preorderLimit: sku.preorderLimit,
        expectedRestockDate: sku.expectedRestockDate,
        paidReservedQuantity: reserved,
        waitingQuantity: waiting,
        readyToFulfillQuantity: ready,
        quotaRemaining: sku.preorderLimit === null ? null : Math.max(0, sku.preorderLimit - reserved),
        quotaExceeded: sku.preorderLimit !== null && reserved > sku.preorderLimit,
      };
    });
    return {
      generatedAt: new Date().toISOString(),
      products,
      alerts: products.filter((product) => product.quotaExceeded),
    };
  }

  async orders(status: 'waiting' | 'ready' | 'all' = 'all') {
    const statusFilter =
      status === 'waiting'
        ? { in: [PreorderLineStatus.PENDING, PreorderLineStatus.ALLOCATED] }
        : status === 'ready'
          ? PreorderLineStatus.READY_TO_FULFILL
          : undefined;
    return this.prisma.preorderLine.findMany({
      where: {
        paymentConfirmedAt: { not: null },
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: { preorderSku: { select: { sku: true, expectedRestockDate: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
