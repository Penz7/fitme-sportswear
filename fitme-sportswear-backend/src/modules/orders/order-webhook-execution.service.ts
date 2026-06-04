import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AddressMappingService } from '../address/address-mapping.service';
import { PrismaService } from '../database/prisma.service';
import { SapoClient } from '../sapo/sapo.client';
import { ShopifyClient } from '../shopify/shopify.client';
import {
  OrderProcessingAction,
  OrderWebhookProcessingPlan,
} from './order-webhook-processing.service';
import { PancakeToSapoPreflightService } from './pancake-to-sapo-preflight.service';

@Injectable()
export class OrderWebhookExecutionService {
  private readonly logger = new Logger(OrderWebhookExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sapoClient: SapoClient,
    private readonly shopifyClient: ShopifyClient,
    private readonly addressMappingService: AddressMappingService,
    private readonly configService: ConfigService,
    private readonly pancakeToSapoPreflightService: PancakeToSapoPreflightService,
  ) {}

  async executePlan(
    plan: OrderWebhookProcessingPlan,
    payload: unknown,
  ): Promise<void> {
    if (plan.nextActions.includes('ignore') || !plan.externalOrderId) {
      return;
    }

    const orderPayload = this.objectPayload(payload);
    let sapoOrderId = await this.findMappedSapoOrderId(plan);
    let sapoOrder: Record<string, any> | null = null;

    for (const action of plan.nextActions) {
      switch (action) {
        case 'create_sapo_order':
          sapoOrderId = await this.createSapoOrder(plan, orderPayload, sapoOrderId);
          break;
        case 'create_sapo_order_if_missing':
          if (!sapoOrderId) {
            sapoOrderId = await this.createSapoOrder(plan, orderPayload, null);
          }
          break;
        case 'finalize_sapo_order':
          if (sapoOrderId) {
            await this.sapoClient.finalizeOrder(sapoOrderId);
          }
          break;
        case 'update_sapo_order':
          if (sapoOrderId) {
            sapoOrder = await this.fetchSapoOrder(sapoOrderId);
            await this.sapoClient.updateOrder(sapoOrderId, {
              order: await this.toSapoOrder(plan, orderPayload, sapoOrder),
            });
          }
          break;
        case 'create_sapo_fulfillment':
        case 'ensure_sapo_fulfillment':
        case 'prepare_viettelpost_handoff':
          if (sapoOrderId) {
            sapoOrder = sapoOrder ?? (await this.fetchSapoOrder(sapoOrderId));
            if (
              action !== 'ensure_sapo_fulfillment' ||
              this.fulfillments(sapoOrder).length === 0
            ) {
              await this.sapoClient.createFulfillment(
                sapoOrderId,
                await this.toSapoFulfillment(orderPayload, sapoOrder),
              );
              sapoOrder = await this.fetchSapoOrder(sapoOrderId);
            }
          }
          break;
        case 'deliver_sapo_order':
          if (sapoOrderId) {
            sapoOrder = sapoOrder ?? (await this.fetchSapoOrder(sapoOrderId));
            const fulfillmentId = this.lastFulfillmentId(sapoOrder);
            if (fulfillmentId) {
              await this.sapoClient.shipFulfillment(sapoOrderId, fulfillmentId);
            }
          }
          break;
        case 'cancel_sapo_delivery_if_exists':
          if (sapoOrderId) {
            sapoOrder = sapoOrder ?? (await this.fetchSapoOrder(sapoOrderId));
            const fulfillmentId = this.lastFulfillmentId(sapoOrder);
            if (fulfillmentId) {
              await this.sapoClient.cancelFulfillment(sapoOrderId, fulfillmentId);
            }
          }
          break;
        case 'receive_after_cancellation_if_needed':
          if (sapoOrderId) {
            sapoOrder = sapoOrder ?? (await this.fetchSapoOrder(sapoOrderId));
            const fulfillmentId = this.lastFulfillmentId(sapoOrder);
            if (fulfillmentId) {
              await this.sapoClient.receiveAfterCancellation(sapoOrderId, fulfillmentId);
            }
          }
          break;
        case 'cancel_sapo_order':
          if (sapoOrderId) {
            await this.sapoClient.cancelOrder(sapoOrderId);
          }
          break;
        case 'create_shopify_fulfillment':
          if (sapoOrderId && plan.platform === 'shopify') {
            sapoOrder = await this.fetchSapoOrder(sapoOrderId);
            await this.createShopifyFulfillment(plan, orderPayload, sapoOrder);
          }
          break;
        case 'upsert_order_mapping':
          await this.upsertOrderMapping(plan, sapoOrderId, sapoOrder);
          break;
        default:
          this.logUnsupportedAction(action);
      }
    }
  }

  private async createSapoOrder(
    plan: OrderWebhookProcessingPlan,
    payload: Record<string, any>,
    existingSapoOrderId: string | null,
  ): Promise<string> {
    if (existingSapoOrderId) {
      return existingSapoOrderId;
    }

    let sapoOrder: Record<string, any>;
    let prepayment: Record<string, any> | null = null;

    if (plan.platform === 'pancake') {
      const preflight = await this.pancakeToSapoPreflightService.preflight(payload);
      if (!preflight.valid || !preflight.sapoOrder) {
        throw new Error(
          `Pancake-to-Sapo preflight failed: ${preflight.errors.join('; ')}`,
        );
      }
      sapoOrder = preflight.sapoOrder;
      prepayment = preflight.prepayment;
    } else {
      sapoOrder = await this.toSapoOrder(plan, payload);
    }

    const created = await this.sapoClient.createOrder({
      order: await this.withSapoCustomerId(sapoOrder),
    });
    const sapoOrderId = this.requiredString(created.order?.id, 'Sapo order id');

    if (prepayment) {
      await this.sapoClient.prepayOrder(sapoOrderId, prepayment);
    }

    return sapoOrderId;
  }

  private async toSapoOrder(
    plan: OrderWebhookProcessingPlan,
    payload: Record<string, any>,
    existingOrder: Record<string, any> = {},
  ): Promise<Record<string, any>> {
    const isShopify = plan.platform === 'shopify';
    const lineItems = await this.toSapoLineItems(
      isShopify ? this.arrayPayload(payload.line_items) : this.arrayPayload(payload.items),
    );
    const address = isShopify
      ? this.shopifyAddress(payload)
      : this.pancakeAddress(payload);

    return {
      ...existingOrder,
      code: isShopify
        ? `AUTO_SHOPIFY_${payload.order_number ?? plan.externalOrderId}`
        : `AUTO_PANCAKE_${plan.externalOrderId}`,
      total: this.numberValue(payload.total_price ?? payload.totalPrice),
      note: payload.note ?? payload.name ?? existingOrder.note ?? null,
      tags: this.arrayPayload(payload.tags),
      shipping_address: address,
      email: payload.bill_email ?? payload.email ?? payload.contact_email ?? null,
      phone_number: this.firstString(
        payload.bill_phone_number,
        address.phone_number,
        payload.phone,
      ),
      customer_data: {
        name: this.firstString(
          payload.bill_full_name,
          address.full_name,
          this.objectPayload(payload.customer).first_name,
          this.objectPayload(payload.customer).name,
        ),
        tags: [],
        addresses: [address],
      },
      order_line_items: lineItems,
      status: 'placed',
      source_id: 307258,
      location_id: this.configNumber('sapo.locationId', 572310),
    };
  }

  private async withSapoCustomerId(
    order: Record<string, any>,
  ): Promise<Record<string, any>> {
    const phoneNumber = this.firstString(order.phone_number);

    if (!phoneNumber) {
      return order;
    }

    const response = await this.sapoClient.fetchCustomers(1, 1, phoneNumber);
    const existingCustomerId = this.firstString(response.customers?.[0]?.id);

    if (existingCustomerId) {
      return {
        ...order,
        customer_id: Number(existingCustomerId),
      };
    }

    const customerData = this.objectPayload(order.customer_data);
    const created = await this.sapoClient.createCustomer({
      customer: {
        phone_number: phoneNumber,
        name: customerData.name ?? phoneNumber,
        addresses: this.arrayPayload(customerData.addresses),
      },
    });
    const createdCustomerId = this.requiredString(
      created.customer?.id,
      'Sapo customer id',
    );

    return {
      ...order,
      customer_id: Number(createdCustomerId),
    };
  }

  private async toSapoLineItems(
    rawItems: Record<string, any>[],
  ): Promise<Record<string, any>[]> {
    return Promise.all(
      rawItems.map(async (item) => {
        const variation = this.objectPayload(item.variation_info ?? item.variationInfo);
        const sku = this.firstString(variation.barcode, item.sku);
        const productMapping = sku
          ? await this.prisma.productMapping.findUnique({ where: { sku } })
          : null;

        return {
          quantity: this.numberValue(item.quantity),
          discount_amount: this.numberValue(item.total_discount ?? item.totalDiscount),
          variant_name: this.firstString(variation.name, item.name, item.title),
          barcode: sku,
          sku,
          price: this.numberValue(variation.retail_price ?? item.price),
          product_id: productMapping?.sapoProductId ?? null,
          variant_id: productMapping?.sapoVariantId ?? null,
        };
      }),
    );
  }

  private async toSapoFulfillment(
    payload: Record<string, any>,
    sapoOrder: Record<string, any>,
  ): Promise<Record<string, any>> {
    const shippingAddress =
      payload.line_items === undefined
        ? this.pancakeAddress(payload)
        : this.shopifyAddress(payload);
    const warehouse = this.objectPayload(payload.warehouse_info ?? payload.warehouseInfo);
    const sapoLineItems = this.arrayPayload(
      sapoOrder.order_line_items ?? sapoOrder.orderLineItems,
    );
    const items =
      payload.line_items === undefined
        ? this.arrayPayload(payload.items)
        : this.arrayPayload(payload.line_items);

    const fulfillmentLineItems = items.map((item) => {
      const variation = this.objectPayload(item.variation_info);
      const sku = this.firstString(variation.barcode, item.sku);
      const sapoLine = sapoLineItems.find((line) => line.sku === sku) ?? {};

      return {
        order_line_item_id: sapoLine.id ?? null,
        quantity: this.numberValue(item.quantity),
        sku,
        product_name: sapoLine.product_name ?? item.name ?? null,
        price: this.numberValue(sapoLine.price ?? variation.retail_price ?? item.price),
      };
    });
    const freightPayer = payload.is_free_shipping ? 'shop' : 'customer';
    const codAmount = this.numberValue(payload.cod ?? payload.money_to_collect) ?? 0;
    const shipping = this.objectPayload(payload.shipping_address ?? payload.shippingAddress);
    const receiverAddress =
      payload.line_items === undefined
        ? await this.addressMappingService.resolvePancakeAddress({
            provinceId: this.numberValue(shipping.province_id ?? shipping.provinceId),
            districtId: this.numberValue(shipping.district_id ?? shipping.districtId),
            wardId: this.numberValue(shipping.commune_id ?? shipping.communeId),
            fallbackProvinceId: this.numberValue(
              shipping.province_id ?? shipping.provinceId,
            ),
            fallbackDistrictId: this.numberValue(
              shipping.district_id ?? shipping.districtId,
            ),
            fallbackWardId: this.numberValue(shipping.commune_id ?? shipping.communeId),
            fallbackWardName: this.firstString(
              shipping.commune_name,
              shipping.communeName,
            ),
          })
        : await this.resolveShopifyTextAddress(shippingAddress);
    const senderAddress = await this.addressMappingService.resolvePancakeAddress({
      provinceId: this.numberValue(warehouse.province_id ?? warehouse.provinceId),
      districtId: this.numberValue(warehouse.district_id ?? warehouse.districtId),
      wardId: this.numberValue(warehouse.commune_id ?? warehouse.communeId),
      fallbackProvinceId: this.numberValue(warehouse.province_id ?? warehouse.provinceId),
      fallbackDistrictId: this.numberValue(warehouse.district_id ?? warehouse.districtId),
      fallbackWardId: this.numberValue(warehouse.commune_id ?? warehouse.communeId),
      fallbackWardName: null,
    });
    const senderProvinceId =
      senderAddress.provinceId ?? this.configNumber('shipping.sender.provinceId', 2);
    const senderDistrictId =
      senderAddress.districtId ?? this.configNumber('shipping.sender.districtId', 55);
    const receiverProvinceId = receiverAddress.provinceId ?? 1;
    const receiverDistrictId = receiverAddress.districtId ?? 688;
    const freightAmount = await this.sapoClient.getFreightAmount({
      senderProvinceId,
      senderDistrictId,
      receiverProvinceId,
      receiverDistrictId,
      codAmount,
      freightPayer,
    });
    const shipmentDetail = this.toViettelShipmentDetail({
      payload,
      warehouse,
      shippingAddress,
      fulfillmentLineItems,
      senderAddress,
      receiverAddress,
      senderProvinceId,
      senderDistrictId,
      receiverProvinceId,
      receiverDistrictId,
      codAmount,
    });

    return {
      fulfillment: {
        notes:
          'Co van de goi shop, khong tu y huy don, Goi khach truoc khi giao',
        delivery_type: 'courier',
        operation_system: 'web',
        shipping_address: shippingAddress,
        billing_address: {
          ...shippingAddress,
          full_name: payload.bill_full_name ?? shippingAddress.full_name,
          phone_number: payload.bill_phone_number ?? shippingAddress.phone_number,
          email: payload.bill_email ?? payload.email ?? '',
        },
        fulfillment_line_items: fulfillmentLineItems,
        shipment: {
          shipping_account_id: this.configString('shipping.viettelPost.accountId', '604003_1'),
          freight_payer: freightPayer,
          operation_system: 'web',
          delivery_service_provider_id: this.configNumber('shipping.viettelPost.providerId', 508146),
          cod_amount: codAmount,
          delivery_fee: 0,
          freight_amount: freightAmount,
          height: this.configNumber('shipping.package.height', 10),
          length: this.configNumber('shipping.package.length', 10),
          width: this.configNumber('shipping.package.width', 10),
          weight: this.configNumber('shipping.package.weight', 300),
          detail: JSON.stringify(shipmentDetail),
        },
      },
    };
  }

  private toViettelShipmentDetail(input: {
    payload: Record<string, any>;
    warehouse: Record<string, any>;
    shippingAddress: Record<string, any>;
    fulfillmentLineItems: Record<string, any>[];
    senderAddress: { wardId: number | null; wardName: string | null };
    receiverAddress: { wardId: number | null; wardName: string | null };
    senderProvinceId: number;
    senderDistrictId: number;
    receiverProvinceId: number;
    receiverDistrictId: number;
    codAmount: number;
  }): Record<string, any> {
    const shipping = this.objectPayload(
      input.payload.shipping_address ?? input.payload.shippingAddress,
    );
    const firstItem = input.fulfillmentLineItems[0] ?? {};
    const listItem = input.fulfillmentLineItems.map((item) => ({
      product_name: item.product_name,
      product_price: item.price,
      product_quantity: item.quantity,
    }));

    return {
      receiver_full_name: input.shippingAddress.full_name,
      receiver_phone: input.shippingAddress.phone_number,
      receiver_address: input.shippingAddress.full_address ?? input.shippingAddress.address1,
      receiver_email: input.shippingAddress.email ?? '',
      receiver_ward: input.receiverAddress.wardName ?? this.firstString(
          shipping.commune_name,
          shipping.communeName,
          input.shippingAddress.ward,
        ),
      receiver_district_id: input.receiverDistrictId,
      receiver_province_id: input.receiverProvinceId,
      sender_phone: this.firstString(input.warehouse.phone_number, input.payload.bill_phone_number),
      sender_email: input.payload.bill_email ?? '',
      sender_address: input.warehouse.full_address ?? input.warehouse.fullAddress ?? '',
      sender_full_name: input.payload.bill_full_name ?? input.shippingAddress.full_name,
      sender_province_id: input.senderProvinceId,
      sender_district_id: input.senderDistrictId,
      sender_ward_id:
        input.senderAddress.wardId ??
        this.numberValue(input.warehouse.commune_id ?? input.warehouse.communeId) ??
        null,
      list_item: listItem,
      order_service: this.configString('shipping.viettelPost.service', 'VSL7'),
      order_service_add: '',
      product_type: 'HH',
      order_payment: 3,
      order_voucher: '',
      product_quantity: input.fulfillmentLineItems.reduce(
        (total, item) => total + (this.numberValue(item.quantity) ?? 0),
        0,
      ),
      product_weight: this.configNumber('shipping.package.weight', 300),
      product_height: this.configNumber('shipping.package.height', 10),
      product_width: this.configNumber('shipping.package.width', 10),
      product_length: this.configNumber('shipping.package.length', 10),
      cod_amount: input.codAmount,
      product_name: firstItem.product_name ?? '',
      product_description: '',
      inventory_id: this.configNumber('shipping.viettelPost.inventoryId', 22207987),
      shipping_account_id: this.configString('shipping.viettelPost.accountId', '604003_1'),
      order_note:
        'Cho xem hang, khong cho thu| Co van de goi shop, khong tu y huy don, Goi khach truoc khi giao',
    };
  }

  private async resolveShopifyTextAddress(address: Record<string, any>) {
    const resolver = (this.addressMappingService as any).resolveSapoAddressText;
    if (typeof resolver !== 'function') {
      return {
        provinceId: null,
        districtId: null,
        wardId: null,
        wardName: null,
        cityName: null,
        districtName: null,
      };
    }

    return resolver.call(this.addressMappingService, {
      provinceName: this.firstString(address.city),
      districtName: this.firstString(address.district),
      wardName: this.firstString(address.ward),
      fullAddress: this.firstString(address.full_address, address.address1),
    });
  }

  private async createShopifyFulfillment(
    plan: OrderWebhookProcessingPlan,
    payload: Record<string, any>,
    sapoOrder: Record<string, any>,
  ): Promise<void> {
    const trackingNumber = await this.waitForSapoTrackingNumber(sapoOrder);

    if (!trackingNumber) {
      throw new Error(`Missing Sapo tracking code for Shopify order ${plan.externalOrderId}`);
    }

    await this.shopifyClient.createFulfillment({
      orderId: this.requiredString(plan.externalOrderId, 'Shopify order id'),
      trackingCompany: this.configString('shipping.viettelPost.trackingCompany', 'Viettel'),
      trackingNumber,
      notifyCustomer: true,
      lineItems: this.arrayPayload(payload.line_items).map((item) => ({
        id: this.requiredString(item.id, 'Shopify line item id'),
        quantity: this.numberValue(item.quantity) ?? 0,
      })),
    });
  }

  private async waitForSapoTrackingNumber(
    initialSapoOrder: Record<string, any>,
  ): Promise<string | null> {
    let sapoOrder = initialSapoOrder;
    const attempts = this.configNumber('shopify.fulfillmentTrackingPollAttempts', 10);
    const delayMs = this.configNumber('shopify.fulfillmentTrackingPollDelayMs', 1000);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const trackingNumber = this.firstString(
        ...this.fulfillments(sapoOrder).map((fulfillment) => {
          const shipment = this.objectPayload(fulfillment.shipment);
          return this.firstString(shipment.tracking_code, shipment.trackingCode);
        }),
      );
      const completedTrackingNumber = this.firstString(
        ...this.fulfillments(sapoOrder).map((fulfillment) => {
          const shipment = this.objectPayload(fulfillment.shipment);
          const pushingStatus = this.firstString(
            shipment.pushing_status,
            shipment.pushingStatus,
          );
          const code = this.firstString(shipment.tracking_code, shipment.trackingCode);
          return pushingStatus === 'completed' ? code : null;
        }),
      );

      if (completedTrackingNumber ?? trackingNumber) {
        return completedTrackingNumber ?? trackingNumber;
      }

      const sapoOrderId = this.firstString(sapoOrder.id);
      if (!sapoOrderId || attempt === attempts - 1) {
        break;
      }

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      sapoOrder = await this.fetchSapoOrder(sapoOrderId);
    }

    return null;
  }

  private async findMappedSapoOrderId(
    plan: OrderWebhookProcessingPlan,
  ): Promise<string | null> {
    if (!plan.externalOrderId) {
      return null;
    }

    const where =
      plan.platform === 'shopify'
        ? { shopifyOrderId: plan.externalOrderId }
        : { pancakeOrderId: plan.externalOrderId };
    const mapping = await this.prisma.orderMapping.findUnique({ where } as any);
    return mapping?.sapoOrderId ?? null;
  }

  private async upsertOrderMapping(
    plan: OrderWebhookProcessingPlan,
    sapoOrderId: string | null,
    sapoOrder: Record<string, any> | null,
  ): Promise<void> {
    if (!plan.externalOrderId) {
      return;
    }

    const currentSapoOrder =
      sapoOrderId && !sapoOrder ? await this.fetchSapoOrder(sapoOrderId) : sapoOrder;
    const data = {
      sapoOrderId,
      pancakeOrderId: plan.platform === 'pancake' ? plan.externalOrderId : undefined,
      shopifyOrderId: plan.platform === 'shopify' ? plan.externalOrderId : undefined,
      pancakeStatus: plan.platform === 'pancake' ? plan.statusCode : undefined,
      pancakeStatusDescription:
        plan.platform === 'pancake' ? plan.statusDescription : undefined,
      shopifyStatus: plan.platform === 'shopify' ? plan.statusDescription : undefined,
      sapoStatus: currentSapoOrder?.status ?? undefined,
      sapoPackedStatus: currentSapoOrder?.packed_status ?? undefined,
      sapoFulfillmentStatus: currentSapoOrder?.fulfillment_status ?? undefined,
      sapoReceivedStatus: currentSapoOrder?.received_status ?? undefined,
      sapoPaymentStatus: currentSapoOrder?.payment_status ?? undefined,
      sapoReturnStatus: currentSapoOrder?.return_status ?? undefined,
    };
    const where =
      plan.platform === 'shopify'
        ? { shopifyOrderId: plan.externalOrderId }
        : { pancakeOrderId: plan.externalOrderId };

    await this.prisma.orderMapping.upsert({
      where,
      create: data,
      update: data,
    } as any);
  }

  private async fetchSapoOrder(orderId: string): Promise<Record<string, any>> {
    const response = await this.sapoClient.fetchOrder(orderId);
    return this.objectPayload(response.order);
  }

  private pancakeAddress(payload: Record<string, any>): Record<string, any> {
    const shipping = this.objectPayload(payload.shipping_address ?? payload.shippingAddress);
    return {
      full_name: this.firstString(shipping.full_name, shipping.fullName, payload.bill_full_name),
      phone_number: this.firstString(
        shipping.phone_number,
        shipping.phoneNumber,
        payload.bill_phone_number,
      ),
      city: shipping.province_name ?? shipping.provinceName ?? null,
      district: shipping.district_name ?? shipping.districtName ?? null,
      address1: shipping.full_address ?? shipping.fullAddress ?? null,
      full_address: shipping.full_address ?? shipping.fullAddress ?? null,
    };
  }

  private shopifyAddress(payload: Record<string, any>): Record<string, any> {
    const shipping = this.objectPayload(payload.shipping_address);
    const billing = this.objectPayload(payload.billing_address);
    const customer = this.objectPayload(payload.customer);
    const defaultAddress = this.objectPayload(customer.default_address);
    const address1 = this.firstString(
      shipping.address2,
      billing.address2,
      defaultAddress.address2,
      shipping.address1,
      billing.address1,
      defaultAddress.address1,
    );

    return {
      full_name: this.firstString(
        shipping.first_name,
        billing.first_name,
        customer.first_name,
        payload.name,
      ),
      phone_number: this.firstString(
        shipping.phone,
        billing.phone,
        defaultAddress.phone,
      ),
      country: this.firstString(shipping.country, billing.country, defaultAddress.country),
      city: this.firstString(shipping.city, billing.city, defaultAddress.city),
      district: this.firstString(shipping.province, billing.province, defaultAddress.province),
      ward: this.firstString(shipping.address1, billing.address1, defaultAddress.address1),
      address1,
      full_address: address1,
    };
  }

  private fulfillments(sapoOrder: Record<string, any>): Record<string, any>[] {
    return this.arrayPayload(sapoOrder.fulfillments);
  }

  private lastFulfillmentId(sapoOrder: Record<string, any>): string | null {
    const fulfillment = this.fulfillments(sapoOrder).at(-1);
    return fulfillment?.id === undefined || fulfillment.id === null
      ? null
      : String(fulfillment.id);
  }

  private objectPayload(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, any>;
  }

  private arrayPayload(value: unknown): Record<string, any>[] {
    return Array.isArray(value) ? (value as Record<string, any>[]) : [];
  }

  private numberValue(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private firstString(...values: unknown[]): string | null {
    for (const value of values) {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value);
      }
    }

    return null;
  }

  private requiredString(value: unknown, label: string): string {
    const normalized = this.firstString(value);
    if (!normalized) {
      throw new Error(`${label} is required`);
    }

    return normalized;
  }

  private logUnsupportedAction(action: OrderProcessingAction): void {
    this.logger.debug(`No executor branch for action ${action}`);
  }

  private configString(key: string, fallback: string): string {
    const value = this.configService.get<string | number | undefined>(key);
    return value === null || value === undefined || String(value).trim() === ''
      ? fallback
      : String(value);
  }

  private configNumber(key: string, fallback: number): number {
    const parsed = Number(this.configService.get<number | string | undefined>(key));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
