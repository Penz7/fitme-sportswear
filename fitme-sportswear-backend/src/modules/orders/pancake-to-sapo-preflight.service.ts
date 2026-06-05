import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { SapoClient } from '../sapo/sapo.client';

export interface PancakeToSapoPreflightResult {
  valid: boolean;
  errors: string[];
  sapoOrder: Record<string, any> | null;
  prepayment: Record<string, any> | null;
  preview: Record<string, any>;
}

@Injectable()
export class PancakeToSapoPreflightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly sapoClient: SapoClient,
  ) {}

  async preflight(payload: unknown): Promise<PancakeToSapoPreflightResult> {
    const order = this.objectValue(payload);
    const errors: string[] = [];
    const orderId = this.stringValue(order.id);
    const status = this.strictNumber(order.status);
    const warehouseId = this.stringValue(
      order.warehouse_id ?? order.warehouseId,
    );
    const locationMappings = this.configService.getOrThrow<
      Record<string, string | number>
    >('sapo.locationIdByPancakeWarehouseId');
    const locationId = warehouseId
      ? this.strictNumber(locationMappings[warehouseId])
      : null;
    const customerName = this.stringValue(order.bill_full_name);
    const customerPhone = this.stringValue(order.bill_phone_number);
    const email = this.stringValue(order.bill_email);
    const total = this.strictNumber(order.total_price ?? order.totalPrice);
    const shipping = this.objectValue(
      order.shipping_address ?? order.shippingAddress,
    );
    const fullAddress = this.stringValue(
      shipping.full_address ?? shipping.fullAddress,
    );
    const provinceId = this.stringValue(
      shipping.province_id ?? shipping.provinceId,
    );
    const provinceName = this.stringValue(
      shipping.province_name ?? shipping.provinceName,
    );
    const districtId = this.stringValue(
      shipping.district_id ?? shipping.districtId,
    );
    const districtName = this.stringValue(
      shipping.district_name ?? shipping.districtName,
    );
    const communeId = this.stringValue(
      shipping.commune_id ?? shipping.communeId,
    );
    const communeName = this.stringValue(
      shipping.commune_name ??
        shipping.commnue_name ??
        shipping.communeName ??
        shipping.commnueName,
    );
    const rawItems = this.arrayValue(order.items);

    if (!orderId) errors.push('Pancake order id is required');
    if (status === null || ![0, 1].includes(status)) {
      errors.push(
        `Pancake order status ${status ?? 'missing'} is not eligible for Sapo order creation`,
      );
    }
    if (!warehouseId) {
      errors.push('Pancake warehouse id is required');
    } else if (locationId === null) {
      errors.push(
        `Pancake warehouse ${warehouseId} is not mapped to a Sapo location`,
      );
    }
    if (!customerName) errors.push('Customer full name is required');
    if (!customerPhone) errors.push('Customer phone number is required');
    if (total === null) errors.push('Total price is required');
    if (!fullAddress) errors.push('Shipping full address is required');
    if (!provinceId) errors.push('Shipping province id is required');
    if (!provinceName) errors.push('Shipping province name is required');
    if (!districtId) errors.push('Shipping district id is required');
    if (!districtName) errors.push('Shipping district name is required');
    if (!communeId) errors.push('Shipping commune id is required');
    if (!communeName) errors.push('Shipping commune name is required');
    if (rawItems.length === 0) errors.push('At least one line item is required');

    if (orderId) {
      const existing = await this.prisma.orderMapping.findUnique({
        where: { pancakeOrderId: orderId },
      });
      if (existing) {
        errors.push(`Pancake order ${orderId} already has an order mapping`);
      }

      const sapoCode = `AUTO_PANCAKE_${orderId}`;
      const existingSapoOrders = await this.sapoClient.fetchOrders({
        page: 1,
        limit: 10,
        query: sapoCode,
      });
      if (existingSapoOrders.orders.some((existingOrder) => existingOrder.code === sapoCode)) {
        errors.push(`Sapo order ${sapoCode} already exists`);
      }
    }

    const [provinceMapping, districtMapping, wardMapping] = await Promise.all([
      provinceId
        ? this.prisma.provinceMapping.findFirst({
            where: { pancakeId: this.strictNumber(provinceId) },
          })
        : null,
      districtId
        ? this.prisma.districtMapping.findFirst({
            where: { pancakeId: this.strictNumber(districtId) },
          })
        : null,
      communeId
        ? this.prisma.wardMapping.findFirst({
            where: { pancakeId: this.strictNumber(communeId) },
          })
        : null,
    ]);
    if (provinceId && !provinceMapping) {
      errors.push(`Shipping province ${provinceId} is not mapped to Sapo`);
    }
    if (districtId && !districtMapping) {
      errors.push(`Shipping district ${districtId} is not mapped to Sapo`);
    }
    if (communeId && !wardMapping) {
      errors.push(`Shipping commune ${communeId} is not mapped to Sapo`);
    }

    const lineItems = await Promise.all(
      rawItems.map(async (rawItem, index) => {
        const item = this.objectValue(rawItem);
        const variation = this.objectValue(
          item.variation_info ?? item.variationInfo,
        );
        const sku = this.stringValue(
          variation.barcode ??
            variation.display_id ??
            variation.displayId ??
            item.sku,
        );
        const quantity = this.strictNumber(item.quantity);
        const price = this.strictNumber(
          variation.retail_price ?? variation.retailPrice ?? item.price,
        );
        const discountAmount = this.strictNumber(
          item.total_discount ?? item.totalDiscount,
        );
        const position = index + 1;

        if (!sku) errors.push(`Line item ${position} SKU is required`);
        if (quantity === null || quantity <= 0) {
          errors.push(`Line item ${position} quantity must be greater than zero`);
        }
        if (price === null) errors.push(`Line item ${position} price is required`);

        const mapping = sku
          ? await this.prisma.productMapping.findUnique({ where: { sku } })
          : null;
        if (sku && (!mapping?.sapoProductId || !mapping?.sapoVariantId)) {
          errors.push(`SKU ${sku} is missing a complete Sapo product mapping`);
        }

        return {
          quantity,
          discount_amount: discountAmount,
          variant_name: this.stringValue(variation.name ?? item.name),
          barcode: sku,
          sku,
          price,
          product_id: mapping?.sapoProductId ?? null,
          variant_id: mapping?.sapoVariantId ?? null,
        };
      }),
    );

    const preview = {
      pancakeOrderId: orderId,
      pancakeStatus: status,
      pancakeWarehouseId: warehouseId,
      sapoLocationId: locationId,
      sapoSourceId: this.configService.getOrThrow<number>(
        'sapo.pancakeSourceId',
      ),
      total,
      customer: {
        name: customerName ? '[REDACTED]' : null,
        phone: customerPhone ? '[REDACTED]' : null,
        email: email ? '[REDACTED]' : null,
      },
      shippingAddress: {
        street: fullAddress ? '[REDACTED]' : null,
        provinceId,
        provinceName,
        districtId,
        districtName,
        communeId,
        communeName,
        sapoProvinceId: provinceMapping?.sapoId ?? null,
        sapoDistrictId: districtMapping?.sapoId ?? null,
        sapoWardId: wardMapping?.sapoId ?? null,
      },
      items: lineItems.map((item) => ({
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        discountAmount: item.discount_amount,
        sapoProductId: item.product_id,
        sapoVariantId: item.variant_id,
      })),
    };

    if (errors.length > 0) {
      return {
        valid: false,
        errors: [...new Set(errors)],
        sapoOrder: null,
        prepayment: null,
        preview,
      };
    }

    const shippingAddress = {
      full_name: customerName,
      phone_number: customerPhone,
      city: provinceName,
      district: districtName,
      ward: communeName,
      address1: fullAddress,
      full_address: fullAddress,
    };
    const prepaid = this.strictNumber(order.prepaid);

    return {
      valid: true,
      errors: [],
      sapoOrder: {
        code: `AUTO_PANCAKE_${orderId}`,
        total,
        note: order.note ?? null,
        tags: Array.isArray(order.tags) ? order.tags : [],
        shipping_address: shippingAddress,
        email,
        phone_number: customerPhone,
        customer_data: {
          name: customerName,
          tags: [],
          addresses: [shippingAddress],
        },
        order_line_items: lineItems,
        status: 'draft',
        source_id:
          this.configService.getOrThrow<number>('sapo.pancakeSourceId'),
        location_id: locationId,
      },
      prepayment:
        prepaid !== null && prepaid > 0
          ? {
              prepayment: {
                payment_method_id: this.configService.getOrThrow<number>(
                  'sapo.prepaymentMethodId',
                ),
                payment_method_name: this.configService.getOrThrow<string>(
                  'sapo.prepaymentMethodName',
                ),
                amount: prepaid,
                paid_amount: prepaid,
                returned_amount: 0,
                paid_on: new Date().toISOString(),
              },
            }
          : null,
      preview,
    };
  }

  private objectValue(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, any>)
      : {};
  }

  private arrayValue(value: unknown): Record<string, any>[] {
    return Array.isArray(value) ? (value as Record<string, any>[]) : [];
  }

  private stringValue(value: unknown): string | null {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }
    return String(value).trim();
  }

  private strictNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
