import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductMappingStatus } from '@prisma/client';
import { AddressMappingService } from '../address/address-mapping.service';
import { PrismaService } from '../database/prisma.service';
import { TelegramNotifierService } from '../notifications/telegram-notifier.service';
import { normalizeSku } from '../products/sku-normalizer';
import { SapoClient } from '../sapo/sapo.client';
import { ShopifyClient } from '../shopify/shopify.client';
import {
  OrderProcessingAction,
  OrderWebhookProcessingPlan,
} from './order-webhook-processing.service';

@Injectable()
export class OrderWebhookExecutionService {
  private readonly logger = new Logger(OrderWebhookExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sapoClient: SapoClient,
    private readonly shopifyClient: ShopifyClient,
    private readonly addressMappingService: AddressMappingService,
    private readonly configService: ConfigService,
    private readonly notifier: TelegramNotifierService,
  ) {}

  async executePlan(
    plan: OrderWebhookProcessingPlan,
    payload: unknown,
  ): Promise<void> {
    if (plan.nextActions.includes('ignore') || !plan.externalOrderId) {
      return;
    }

    const orderPayload = this.objectPayload(payload);
    const sapoLocationId = this.resolveSapoLocationId(plan, orderPayload);
    let sapoOrderId = await this.findMappedSapoOrderId(plan);
    let sapoOrder: Record<string, any> | null = null;
    let skipReceiveAfterCancellation = false;

    for (const action of plan.nextActions) {
      switch (action) {
        case 'create_sapo_order':
          sapoOrderId = await this.createSapoOrder(
            plan,
            orderPayload,
            sapoOrderId,
            sapoLocationId,
          );
          await this.updateShopifyMappingStatus(plan, sapoOrderId, 'NEW');
          break;
        case 'create_sapo_order_if_missing':
          if (!sapoOrderId) {
            sapoOrderId = await this.createSapoOrder(
              plan,
              orderPayload,
              null,
              sapoLocationId,
            );
            await this.updateShopifyMappingStatus(plan, sapoOrderId, 'NEW');
          }
          break;
        case 'finalize_sapo_order':
          if (sapoOrderId) {
            await this.sapoClient.finalizeOrder(sapoOrderId, {
              locationId: sapoLocationId,
              tolerateIdempotent422: true,
            });
            await this.prepaySapoOrderIfNeeded(
              sapoOrderId,
              orderPayload,
              sapoLocationId,
            );
            sapoOrder = await this.fetchSapoOrder(sapoOrderId);
            await this.verifyPancakeSapoShippingAddress(
              plan,
              orderPayload,
              sapoOrderId,
              sapoOrder,
            );
            await this.updateShopifyMappingStatus(plan, sapoOrderId, 'CONFIRMED', sapoOrder);
          }
          break;
        case 'update_sapo_order':
          if (sapoOrderId) {
            sapoOrder = await this.fetchSapoOrder(sapoOrderId);
            await this.sapoClient.updateOrder(
              sapoOrderId,
              {
                order: await this.toSapoOrder(
                  plan,
                  orderPayload,
                  sapoOrder,
                  sapoLocationId,
                ),
              },
              { locationId: sapoLocationId },
            );
            sapoOrder = await this.fetchSapoOrder(sapoOrderId);
            await this.verifyPancakeSapoShippingAddress(
              plan,
              orderPayload,
              sapoOrderId,
              sapoOrder,
            );
            await this.updateShopifyMappingStatus(plan, sapoOrderId, 'CONFIRMED', sapoOrder);
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
              const fulfillmentData = await this.safeSapoFulfillmentData(
                action,
                plan,
                orderPayload,
                sapoOrderId,
                sapoOrder,
              );
              if (!fulfillmentData) {
                break;
              }
              const created = await this.createSapoFulfillmentIfAllowed(
                sapoOrderId,
                fulfillmentData,
                { locationId: sapoLocationId, tolerateIdempotent422: true },
              );
              if (created) {
                sapoOrder = await this.fetchSapoOrder(sapoOrderId);
                await this.updateShopifyMappingStatus(
                  plan,
                  sapoOrderId,
                  'PACKING',
                  sapoOrder,
                );
              }
            }
          }
          break;
        case 'deliver_sapo_order':
          if (sapoOrderId) {
            sapoOrder = sapoOrder ?? (await this.fetchSapoOrder(sapoOrderId));
            const fulfillmentId = this.lastFulfillmentId(sapoOrder);
            if (fulfillmentId) {
              await this.sapoClient.shipFulfillment(sapoOrderId, fulfillmentId, {
                locationId: sapoLocationId,
                tolerateIdempotent422: true,
              });
              sapoOrder = await this.fetchSapoOrder(sapoOrderId);
            }
          }
          break;
        case 'cancel_sapo_delivery_if_exists':
          if (sapoOrderId) {
            sapoOrder = sapoOrder ?? (await this.fetchSapoOrder(sapoOrderId));
            const fulfillment = this.lastFulfillment(sapoOrder);
            const fulfillmentId = this.fulfillmentId(fulfillment);
            if (fulfillment && fulfillmentId) {
              if (this.isFulfillmentCancelled(fulfillment)) {
                break;
              }
              try {
                await this.sapoClient.cancelFulfillment(
                  sapoOrderId,
                  fulfillmentId,
                  this.fulfillmentCancellationPayload(fulfillment, 'cancel'),
                  { locationId: sapoLocationId, tolerateIdempotent422: true },
                );
                sapoOrder = await this.fetchSapoOrder(sapoOrderId);
              } catch (error) {
                if (this.isInvalidSapoFulfillmentCancellation(error)) {
                  const latestSapoOrder = await this.fetchSapoOrder(sapoOrderId);
                  if (this.isFulfillmentCancelled(this.lastFulfillment(latestSapoOrder))) {
                    sapoOrder = latestSapoOrder;
                    break;
                  }
                  sapoOrder = latestSapoOrder;
                  skipReceiveAfterCancellation = true;
                  break;
                }
                if (!this.isMissingFulfillmentPermission(error)) {
                  throw error;
                }
                await this.notifyFulfillmentPermissionBypassed(
                  'cancel',
                  sapoOrderId,
                  fulfillmentId,
                );
              }
            }
          }
          break;
        case 'receive_after_cancellation_if_needed':
          if (skipReceiveAfterCancellation) {
            break;
          }
          if (sapoOrderId) {
            sapoOrder = sapoOrder ?? (await this.fetchSapoOrder(sapoOrderId));
            const fulfillment = this.lastFulfillment(sapoOrder);
            const fulfillmentId = this.fulfillmentId(fulfillment);
            if (fulfillment && fulfillmentId) {
              if (this.isFulfillmentCancelled(fulfillment)) {
                break;
              }
              try {
                await this.sapoClient.receiveAfterCancellation(
                  sapoOrderId,
                  fulfillmentId,
                  this.fulfillmentCancellationPayload(fulfillment, 'receive'),
                  { locationId: sapoLocationId, tolerateIdempotent422: true },
                );
                sapoOrder = await this.fetchSapoOrder(sapoOrderId);
              } catch (error) {
                if (this.isInvalidSapoFulfillmentCancellation(error)) {
                  const latestSapoOrder = await this.fetchSapoOrder(sapoOrderId);
                  if (this.isFulfillmentCancelled(this.lastFulfillment(latestSapoOrder))) {
                    sapoOrder = latestSapoOrder;
                    break;
                  }
                }
                if (!this.isMissingFulfillmentPermission(error)) {
                  throw error;
                }
                await this.notifyFulfillmentPermissionBypassed(
                  'receive_after_cancellation',
                  sapoOrderId,
                  fulfillmentId,
                );
              }
            }
          }
          break;
        case 'cancel_sapo_order':
          if (sapoOrderId) {
            await this.sapoClient.cancelOrder(sapoOrderId, {
              locationId: sapoLocationId,
              tolerateIdempotent422: true,
            });
            sapoOrder = await this.fetchSapoOrder(sapoOrderId);
          }
          break;
        case 'create_shopify_fulfillment':
          if (sapoOrderId && plan.platform === 'shopify') {
            sapoOrder = await this.fetchSapoOrder(sapoOrderId);
            const created = await this.createShopifyFulfillment(plan, orderPayload, sapoOrder);
            if (created) {
              await this.updateShopifyMappingStatus(plan, sapoOrderId, 'FULFILLMENT', sapoOrder);
            }
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
    sapoLocationId: string,
  ): Promise<string> {
    if (existingSapoOrderId) {
      return existingSapoOrderId;
    }

    const order = await this.withSapoCustomerId(
      await this.toSapoOrder(plan, payload, {}, sapoLocationId),
    );
    const existingSapoOrder = await this.findExistingSapoOrderByCode(order.code);
    if (existingSapoOrder) {
      return this.requiredString(existingSapoOrder.id, 'Sapo order id');
    }

    const created = await this.sapoClient.createOrder(
      { order },
      { locationId: sapoLocationId },
    );
    return this.requiredString(created.order?.id, 'Sapo order id');
  }

  private async updateShopifyMappingStatus(
    plan: OrderWebhookProcessingPlan,
    sapoOrderId: string | null,
    shopifyStatus: string,
    sapoOrder: Record<string, any> | null = null,
  ): Promise<void> {
    if (plan.platform !== 'shopify' || !plan.externalOrderId) {
      return;
    }

    await this.prisma.orderMapping.upsert({
      where: { shopifyOrderId: plan.externalOrderId },
      create: {
        shopifyOrderId: plan.externalOrderId,
        sapoOrderId,
        shopifyStatus,
        sapoStatus: sapoOrder?.status ?? undefined,
        sapoPackedStatus: sapoOrder?.packed_status ?? undefined,
        sapoFulfillmentStatus: sapoOrder?.fulfillment_status ?? undefined,
        sapoReceivedStatus: sapoOrder?.received_status ?? undefined,
        sapoPaymentStatus: sapoOrder?.payment_status ?? undefined,
        sapoReturnStatus: sapoOrder?.return_status ?? undefined,
      },
      update: {
        sapoOrderId,
        shopifyStatus,
        sapoStatus: sapoOrder?.status ?? undefined,
        sapoPackedStatus: sapoOrder?.packed_status ?? undefined,
        sapoFulfillmentStatus: sapoOrder?.fulfillment_status ?? undefined,
        sapoReceivedStatus: sapoOrder?.received_status ?? undefined,
        sapoPaymentStatus: sapoOrder?.payment_status ?? undefined,
        sapoReturnStatus: sapoOrder?.return_status ?? undefined,
      },
    } as any);
  }

  private async findExistingSapoOrderByCode(
    code: unknown,
  ): Promise<Record<string, any> | null> {
    const orderCode = this.firstString(code);
    if (!orderCode || !this.sapoClient.findOrderByCode) {
      return null;
    }

    return this.sapoClient.findOrderByCode(orderCode);
  }

  private async prepaySapoOrderIfNeeded(
    sapoOrderId: string,
    payload: Record<string, any>,
    sapoLocationId: string,
  ): Promise<void> {
    const prepaid = this.numberValue(payload.prepaid);
    if (!prepaid || prepaid <= 0) {
      return;
    }

    await this.sapoClient.prepayOrder(
      sapoOrderId,
      {
        prepayment: {
          payment_method_id: this.configNumber('sapo.prepaymentMethodId', 2575663),
          payment_method_name: this.configString(
            'sapo.prepaymentMethodName',
            'Chuyen khoan',
          ),
          amount: prepaid,
          paid_amount: prepaid,
          returned_amount: 0,
          paid_on: new Date().toISOString(),
        },
      },
      { locationId: sapoLocationId },
    );
  }

  private async toSapoOrder(
    plan: OrderWebhookProcessingPlan,
    payload: Record<string, any>,
    existingOrder: Record<string, any> = {},
    sapoLocationId = this.resolveSapoLocationId(plan, payload),
  ): Promise<Record<string, any>> {
    const isShopify = plan.platform === 'shopify';
    const shopifyVoucherDiscount = isShopify
      ? this.shopifyVoucherDiscount(payload)
      : null;
    const lineItems = await this.toSapoLineItems(
      isShopify ? this.arrayPayload(payload.line_items) : this.arrayPayload(payload.items),
      !shopifyVoucherDiscount,
    );
    const address = isShopify
      ? await this.shopifyAddress(payload)
      : this.pancakeAddress(payload);
    const note = isShopify
      ? this.mergeSapoNote(existingOrder.note, this.shopifyOrderNote(payload))
      : payload.note ?? payload.name ?? existingOrder.note ?? null;
    const shopifyShippingFee = isShopify
      ? this.shopifyShippingFee(payload)
      : null;

    return {
      ...existingOrder,
      code: isShopify
        ? `AUTO_SHOPIFY_${payload.order_number ?? plan.externalOrderId}`
        : `AUTO_PANCAKE_${plan.externalOrderId}`,
      total: this.numberValue(payload.total_price ?? payload.totalPrice),
      note,
      ...(shopifyShippingFee !== null
        ? {
            delivery_fee: {
              shipping_cost_name: 'Phi van chuyen Shopify',
              fee: shopifyShippingFee,
            },
          }
        : {}),
      ...(shopifyVoucherDiscount
        ? {
            order_discount_rate: 0,
            order_discount_value: shopifyVoucherDiscount.amount,
            order_discount_amount: shopifyVoucherDiscount.amount,
            discount_items: [
              {
                source: 'manual',
                rate: 0,
                value: shopifyVoucherDiscount.amount,
                amount: shopifyVoucherDiscount.amount,
                reason: `voucher seller: [${shopifyVoucherDiscount.codes.join(', ')}]`,
                promotion_redemption_id: null,
                promotion_condition_item_id: null,
              },
            ],
          }
        : {}),
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
      // The shop's Sapo endpoint requires `order_line_items` for every order
      // create. Unlike Sapo's public legacy API, `line_items` is rejected here.
      order_line_items: lineItems,
      status: 'draft',
      source_id: this.configNumber('sapo.pancakeSourceId', 307258),
      location_id: Number(sapoLocationId),
    };
  }

  private shopifyOrderNote(payload: Record<string, any>): string | null {
    const parts: string[] = [];
    const customerNote = this.firstString(payload.note);
    if (customerNote) {
      parts.push(`Khach Shopify: ${customerNote}`);
    }

    for (const attribute of this.arrayPayload(
      payload.note_attributes ?? payload.noteAttributes,
    )) {
      const name = this.firstString(attribute.name, attribute.key, attribute.label);
      const value = this.firstString(attribute.value);
      if (name && value) {
        parts.push(`Shopify - ${name}: ${value}`);
      }
    }

    const voucherCodes = this.shopifyVoucherCodes(payload);
    if (voucherCodes.length > 0) {
      parts.push(`Voucher Shopify: ${voucherCodes.join(', ')}`);
    }

    return parts.length > 0 ? parts.join('\n') : null;
  }

  private shopifyShippingFee(payload: Record<string, any>): number | null {
    const shippingLines = this.arrayPayload(
      payload.shipping_lines ?? payload.shippingLines,
    ).filter((line) => line.is_removed !== true && line.isRemoved !== true);
    if (shippingLines.length === 0) {
      return null;
    }

    return shippingLines.reduce(
      (total, line) =>
        total +
        (this.numberValue(
          line.discounted_price ?? line.discountedPrice ?? line.price,
        ) ?? 0),
      0,
    );
  }

  private shopifyVoucherCodes(payload: Record<string, any>): string[] {
    const codes = this.shopifyDiscountCodes(payload)
      .map((discount) => this.firstString(discount.code))
      .filter((code): code is string => Boolean(code));
    return [...new Set(codes)];
  }

  private shopifyDiscountCodes(payload: Record<string, any>): Array<Record<string, any>> {
    const codes: Array<Record<string, any>> = [];

    for (const discount of this.arrayPayload(
      payload.discount_codes ?? payload.discountCodes,
    )) {
      const code = this.firstString(discount.code);
      const amount = this.numberValue(discount.amount);
      const type = this.firstString(discount.type);
      if (code && amount !== null && amount > 0 && type) {
        codes.push({ code, amount, type });
      }
    }

    return codes;
  }

  private shopifyVoucherDiscount(
    payload: Record<string, any>,
  ): { codes: string[]; amount: number } | null {
    const codes = this.shopifyVoucherCodes(payload);
    const amount = this.numberValue(
      payload.total_discounts ?? payload.totalDiscounts,
    );
    if (codes.length === 0 || amount === null || amount <= 0) {
      return null;
    }

    return { codes, amount };
  }

  private mergeSapoNote(existingNote: unknown, incomingNote: string | null): string | null {
    const existing = this.firstString(existingNote);
    if (!incomingNote) {
      return existing;
    }
    if (!existing) {
      return incomingNote;
    }

    const existingLines = new Set(
      existing
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    );
    const additions = incomingNote
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !existingLines.has(line));

    return additions.length > 0 ? `${existing}\n${additions.join('\n')}` : existing;
  }

  private resolveSapoLocationId(
    plan: OrderWebhookProcessingPlan,
    payload: Record<string, any>,
  ): string {
    const defaultLocationId = this.configString('sapo.locationId', '572310');

    if (plan.platform !== 'pancake') {
      return defaultLocationId;
    }

    const pancakeWarehouseId = this.resolvePancakeWarehouseId(payload);
    const locationMap = this.configRecord('sapo.locationIdByPancakeWarehouseId');

    return pancakeWarehouseId && locationMap[pancakeWarehouseId]
      ? locationMap[pancakeWarehouseId]
      : defaultLocationId;
  }

  private resolvePancakeWarehouseId(payload: Record<string, any>): string | null {
    const warehouse = this.objectPayload(payload.warehouse);
    const warehouseInfo = this.objectPayload(
      payload.warehouse_info ?? payload.warehouseInfo,
    );

    return this.firstString(
      payload.warehouse_id,
      payload.warehouseId,
      warehouse.id,
      warehouse.warehouse_id,
      warehouse.warehouseId,
      warehouseInfo.id,
      warehouseInfo.warehouse_id,
      warehouseInfo.warehouseId,
    );
  }

  private async withSapoCustomerId(
    order: Record<string, any>,
  ): Promise<Record<string, any>> {
    const phoneNumber = this.firstString(order.phone_number);

    if (!phoneNumber) {
      return order;
    }

    let response: Awaited<ReturnType<SapoClient['fetchCustomers']>>;
    try {
      response = await this.sapoClient.fetchCustomers(
        1,
        1,
        this.toSapoCustomerLookupQuery(phoneNumber),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Sapo customers fetch failed with status 403')
      ) {
        this.logger.warn(
          'Sapo customer lookup returned 403; continuing without customer_id and relying on order shipping_address',
        );
        return order;
      }

      throw error;
    }
    const existingCustomerId = this.firstString(response.customers?.[0]?.id);

    if (existingCustomerId) {
      return {
        ...order,
        customer_id: Number(existingCustomerId),
      };
    }

    try {
      return await this.createSapoCustomerForOrder(order, phoneNumber);
    } catch (error) {
      if (this.isDuplicateCustomerPhoneError(error)) {
        const existingCustomerId = await this.findExistingSapoCustomerId(phoneNumber);
        if (existingCustomerId) {
          return {
            ...order,
            customer_id: Number(existingCustomerId),
          };
        }
      }

      if (this.isMissingCustomerCreatePermission(error)) {
        this.logger.warn(
          'Continuing without Sapo customer_id because token is missing create_customer permission',
        );
        await this.notifier.sendMessage(
          'Sapo customer create permission missing',
          [
            `phone=${phoneNumber}`,
            `customerName=${this.objectPayload(order.customer_data).name ?? ''}`,
            'status=order will be created from shipping_address only; keep Sapo source as WebOrder to avoid auto fulfillment address fallback',
          ].join('\n'),
        );
        return order;
      }

      throw error;
    }
  }

  private async findExistingSapoCustomerId(
    phoneNumber: string,
  ): Promise<string | null> {
    for (const query of this.sapoCustomerLookupQueries(phoneNumber)) {
      const response = await this.sapoClient.fetchCustomers(1, 10, query);
      const customerId = this.firstString(response.customers?.[0]?.id);
      if (customerId) {
        return customerId;
      }
    }

    return null;
  }

  private toSapoCustomerLookupQuery(phoneNumber: string): string {
    return this.sapoCustomerLookupQueries(phoneNumber)[0] ?? phoneNumber;
  }

  private sapoCustomerLookupQueries(phoneNumber: string): string[] {
    const raw = this.firstString(phoneNumber);
    const digits = this.normalizeDigits(phoneNumber);
    const candidates = new Set<string>();

    if (digits?.startsWith('84') && digits.length >= 10) {
      candidates.add(`0${digits.slice(2)}`);
    }

    if (raw) {
      candidates.add(raw);
    }

    if (digits) {
      candidates.add(digits);
    }

    if (digits?.startsWith('0') && digits.length >= 10) {
      candidates.add(`84${digits.slice(1)}`);
      candidates.add(`+84${digits.slice(1)}`);
    }

    return [...candidates];
  }

  private async createSapoCustomerForOrder(
    order: Record<string, any>,
    phoneNumber: string,
  ): Promise<Record<string, any>> {
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
    includeDiscounts = true,
  ): Promise<Record<string, any>[]> {
    return Promise.all(
      rawItems.map(async (item) => {
        const variation = this.objectPayload(item.variation_info ?? item.variationInfo);
        const sku = this.normalizedSku(variation.barcode, item.sku);
        if (!sku) {
          throw new Error('Missing SKU for Sapo order line item');
        }

        const productMapping = await this.resolveSapoProductMapping(sku);
        if (!productMapping?.sapoProductId || !productMapping?.sapoVariantId) {
          throw new Error(`Missing Sapo product mapping for SKU ${sku}`);
        }

        return {
          quantity: this.numberValue(item.quantity),
          discount_amount: includeDiscounts
            ? this.shopifyLineDiscountAmount(item)
            : 0,
          variant_name: this.firstString(variation.name, item.name, item.title),
          barcode: sku,
          sku,
          price: this.numberValue(variation.retail_price ?? item.price),
          product_id: productMapping.sapoProductId,
          variant_id: productMapping.sapoVariantId,
        };
      }),
    );
  }

  private shopifyLineDiscountAmount(item: Record<string, any>): number {
    const declaredDiscount =
      this.numberValue(item.total_discount ?? item.totalDiscount) ?? 0;
    const allocatedDiscount = this.arrayPayload(
      item.discount_allocations ?? item.discountAllocations,
    ).reduce(
      (total, allocation) =>
        total +
        (this.numberValue(
          allocation.amount ?? allocation.discount_amount ?? allocation.discountAmount,
        ) ?? 0),
      0,
    );

    return Math.max(declaredDiscount, allocatedDiscount);
  }

  private async resolveSapoProductMapping(sku: string) {
    const productMapping = await this.prisma.productMapping.findUnique({
      where: { sku },
    });
    if (productMapping?.sapoProductId && productMapping?.sapoVariantId) {
      return productMapping;
    }

    const sapoProduct = await this.prisma.sapoProduct.findUnique({
      where: { sku },
    });
    if (!sapoProduct?.productId || !sapoProduct?.variantId) {
      return productMapping;
    }

    return this.prisma.productMapping.upsert({
      where: { sku },
      create: {
        sku,
        sapoProductId: sapoProduct.productId,
        sapoVariantId: sapoProduct.variantId,
        status: ProductMappingStatus.partial,
      },
      update: {
        sapoProductId: sapoProduct.productId,
        sapoVariantId: sapoProduct.variantId,
        status: ProductMappingStatus.partial,
      },
    });
  }

  private async toSapoFulfillment(
    payload: Record<string, any>,
    sapoOrder: Record<string, any>,
  ): Promise<Record<string, any>> {
    const isShopifyOrder = payload.line_items !== undefined;
    const shippingAddress =
      !isShopifyOrder
        ? this.pancakeAddress(payload)
        : await this.shopifyAddress(payload);
    const warehouse = this.objectPayload(payload.warehouse_info ?? payload.warehouseInfo);
    const sapoLineItems = this.arrayPayload(
      sapoOrder.order_line_items ?? sapoOrder.orderLineItems,
    );
    const items =
      !isShopifyOrder
        ? this.arrayPayload(payload.items)
        : this.arrayPayload(payload.line_items);

    const fulfillmentLineItems = await Promise.all(items.map(async (item) => {
      const variation = this.objectPayload(item.variation_info);
      const sku = this.normalizedSku(variation.barcode, item.sku);
      const sapoLine = await this.findSapoLineItem(sapoLineItems, sku);

      return {
        order_line_item_id: sapoLine?.id ?? null,
        quantity: this.numberValue(item.quantity),
        sku,
        product_name: sapoLine?.product_name ?? item.name ?? null,
        price: this.numberValue(sapoLine?.price ?? variation.retail_price ?? item.price),
      };
    }));
    const freightPayer = isShopifyOrder
      ? 'shop'
      : payload.is_free_shipping ? 'shop' : 'customer';
    const shipmentCodAmount = isShopifyOrder
      ? 0
      : this.numberValue(payload.cod ?? payload.money_to_collect) ?? 0;
    const detailCodAmount = isShopifyOrder
      ? this.numberValue(payload.total_price ?? payload.totalPrice) ?? 0
      : shipmentCodAmount;
    const shipping = this.objectPayload(payload.shipping_address ?? payload.shippingAddress);
    const receiverAddress =
      !isShopifyOrder
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
            fallbackProvinceName: this.firstString(
              shipping.province_name,
              shipping.provinceName,
            ),
            fallbackDistrictName: this.firstString(
              shipping.district_name,
              shipping.districtName,
            ),
            fallbackWardName: this.firstString(
              shipping.commune_name,
              shipping.commnue_name,
              shipping.communeName,
              shipping.commnueName,
            ),
            fallbackFullAddress: this.firstString(
              shipping.full_address,
              shipping.fullAddress,
              shipping.new_full_address,
              shipping.newFullAddress,
            ),
          })
        : await this.resolveShopifyTextAddress(shippingAddress);
    const senderAddress = isShopifyOrder
      ? { provinceId: 2, districtId: 55, wardId: 947, wardName: null }
      : await this.resolveSenderAddress(warehouse);
    const senderProvinceId = this.requiredAddressId(
      senderAddress.provinceId,
      'sender province',
    );
    const senderDistrictId = this.requiredAddressId(
      senderAddress.districtId,
      'sender district',
    );
    const receiverProvinceId = this.requiredAddressId(
      receiverAddress.provinceId,
      'receiver province',
    );
    const receiverDistrictId = this.requiredAddressId(
      receiverAddress.districtId,
      'receiver district',
    );
    const freightAmount = await this.safeFreightAmount({
      senderProvinceId,
      senderDistrictId,
      receiverProvinceId,
      receiverDistrictId,
      codAmount: shipmentCodAmount,
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
      codAmount: detailCodAmount,
      legacyShopifySender: isShopifyOrder,
    });

    return {
      fulfillment: {
        notes:
          'Co van de goi shop, khong tu y huy don, Goi khach truoc khi giao',
        delivery_type: 'courier',
        operation_system: 'web',
        sender_phone: shipmentDetail.sender_phone,
        sender_address: shipmentDetail.sender_address,
        sender_full_name: shipmentDetail.sender_full_name,
        sender_province_id: shipmentDetail.sender_province_id,
        sender_district_id: shipmentDetail.sender_district_id,
        sender_ward_id: shipmentDetail.sender_ward_id,
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
          sender_phone: shipmentDetail.sender_phone,
          sender_address: shipmentDetail.sender_address,
          sender_full_name: shipmentDetail.sender_full_name,
          sender_province_id: shipmentDetail.sender_province_id,
          sender_district_id: shipmentDetail.sender_district_id,
          sender_ward_id: shipmentDetail.sender_ward_id,
          cod_amount: shipmentCodAmount,
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

  private async safeFreightAmount(input: {
    senderProvinceId: number;
    senderDistrictId: number;
    receiverProvinceId: number;
    receiverDistrictId: number;
    codAmount: number;
    freightPayer: string;
  }): Promise<number> {
    try {
      return (
        (await this.sapoClient.getFreightAmount(input)) ?? 0
      );
    } catch (error) {
      this.logger.warn(
        `Falling back to freight_amount=0 because Sapo freight fetch failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return 0;
    }
  }

  private async createSapoFulfillmentIfAllowed(
    sapoOrderId: string,
    fulfillmentData: Record<string, any>,
    options: { locationId?: string; tolerateIdempotent422?: boolean },
  ): Promise<boolean> {
    try {
      await this.sapoClient.createFulfillment(
        sapoOrderId,
        fulfillmentData,
        options,
      );
      return true;
    } catch (error) {
      if (this.isMissingFulfillmentPermission(error)) {
        this.logger.warn(
          'Skipping Sapo fulfillment creation because token is missing add_fulfillment_order permission',
        );
        return false;
      }
      throw error;
    }
  }

  private async safeSapoFulfillmentData(
    action: OrderProcessingAction,
    plan: OrderWebhookProcessingPlan,
    orderPayload: Record<string, any>,
    sapoOrderId: string,
    sapoOrder: Record<string, any>,
  ): Promise<Record<string, any> | null> {
    try {
      return await this.toSapoFulfillment(orderPayload, sapoOrder);
    } catch (error) {
      if (!this.isMissingSapoAddressMapping(error)) {
        throw error;
      }

      await this.notifyFulfillmentBypassed({
        action,
        plan,
        orderPayload,
        sapoOrderId,
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private isMissingSapoAddressMapping(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.startsWith('Missing Sapo address mapping for ');
  }

  private async notifyFulfillmentBypassed(input: {
    action: OrderProcessingAction;
    plan: OrderWebhookProcessingPlan;
    orderPayload: Record<string, any>;
    sapoOrderId: string;
    reason: string;
  }): Promise<void> {
    const shipping = this.objectPayload(
      input.orderPayload.shipping_address ?? input.orderPayload.shippingAddress,
    );
    const missing = input.reason.replace('Missing Sapo address mapping for ', '');
    const pancakeOrderId =
      input.plan.platform === 'pancake' ? input.plan.externalOrderId : null;

    this.logger.warn(
      `Bypassing Sapo fulfillment for ${input.plan.platform} order ${
        input.plan.externalOrderId
      }: ${input.reason}`,
    );

    await this.notifier.sendMessage(
      'Bypassed Sapo fulfillment because address mapping is incomplete',
      [
        `platform=${input.plan.platform}`,
        `action=${input.action}`,
        `pancakeOrderId=${pancakeOrderId ?? ''}`,
        `sapoOrderId=${input.sapoOrderId}`,
        `missing=${missing}`,
        `province=${this.firstString(shipping.province_name, shipping.provinceName) ?? ''}`,
        `provinceId=${this.firstString(shipping.province_id, shipping.provinceId) ?? ''}`,
        `district=${this.firstString(shipping.district_name, shipping.districtName) ?? ''}`,
        `districtId=${this.firstString(shipping.district_id, shipping.districtId) ?? ''}`,
        `ward=${this.firstString(
          shipping.commune_name,
          shipping.commnue_name,
          shipping.communeName,
          shipping.commnueName,
        ) ?? ''}`,
        `wardId=${this.firstString(shipping.commune_id, shipping.communeId) ?? ''}`,
        `fullAddress=${this.firstString(
          shipping.full_address,
          shipping.fullAddress,
          shipping.new_full_address,
          shipping.newFullAddress,
        ) ?? ''}`,
        'status=order mapping kept; fulfillment/freight skipped until address is fixed',
      ].join('\n'),
    );
  }

  private isMissingFulfillmentPermission(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('status 403') &&
      message.includes('add_fulfillment_order')
    );
  }

  private isInvalidSapoFulfillmentCancellation(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('Sapo fulfillment') &&
      message.includes('status 500') &&
      message.includes('invalid data or exception')
    );
  }

  private async notifyFulfillmentPermissionBypassed(
    action: string,
    sapoOrderId: string,
    fulfillmentId: string,
  ): Promise<void> {
    const message =
      `Skipping Sapo fulfillment ${action} because token is missing add_fulfillment_order permission`;
    this.logger.warn(message);
    await this.notifier.sendMessage(
      'Bypassed Sapo fulfillment action because Sapo token lacks permission',
      [
        `action=${action}`,
        `sapoOrderId=${sapoOrderId}`,
        `fulfillmentId=${fulfillmentId}`,
        'permission=add_fulfillment_order',
        'status=continuing order status sync',
      ].join('\n'),
    );
  }

  private isMissingCustomerCreatePermission(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('status 403') && message.includes('create_customer');
  }

  private isDuplicateCustomerPhoneError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('Sapo customer create failed with status 422') &&
      message.includes('phone_number')
    );
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
    legacyShopifySender?: boolean;
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
      sender_phone: input.legacyShopifySender
        ? '0707121868'
        : this.firstString(
            input.warehouse.phone_number,
            input.warehouse.phoneNumber,
            this.configService.get<string>('shipping.sender.phone'),
            this.configService.get<string>('sapo.phoneNumber'),
            input.payload.bill_phone_number,
          ),
      sender_email: input.legacyShopifySender ? 'mathkudo@gmail.com' : input.payload.bill_email ?? '',
      sender_address:
        input.legacyShopifySender
          ? '11/4b Pham Van Sang Ap 2, X.Xuan Thoi Thuong, H.Hoc Mon, TP.Ho Chi Minh'
          : this.firstString(
              input.warehouse.full_address,
              input.warehouse.fullAddress,
              this.configService.get<string>('shipping.sender.address'),
            ) ?? '',
      sender_full_name: input.legacyShopifySender
        ? input.shippingAddress.full_name
        : this.firstString(
            input.warehouse.name,
            input.warehouse.full_name,
            input.warehouse.fullName,
            this.configService.get<string>('shipping.sender.fullName'),
            input.payload.bill_full_name,
            input.shippingAddress.full_name,
          ),
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
  ): Promise<boolean> {
    const trackingNumber = await this.waitForSapoTrackingNumber(sapoOrder);

    if (!trackingNumber) {
      this.logger.warn(
        `Skipping Shopify fulfillment for order ${plan.externalOrderId} because Sapo tracking code is not available yet`,
      );
      return false;
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
    return true;
  }

  private async waitForSapoTrackingNumber(
    initialSapoOrder: Record<string, any>,
  ): Promise<string | null> {
    let sapoOrder = initialSapoOrder;
    const attempts = this.configNumber('shopify.fulfillmentTrackingPollAttempts', 10);
    const delayMs = this.configNumber('shopify.fulfillmentTrackingPollDelayMs', 1000);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
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

      if (completedTrackingNumber) {
        return completedTrackingNumber;
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
    const where =
      plan.platform === 'shopify'
        ? { shopifyOrderId: plan.externalOrderId }
        : { pancakeOrderId: plan.externalOrderId };
    const existingMapping = await this.prisma.orderMapping.findUnique({ where } as any);
    const data = {
      sapoOrderId,
      pancakeOrderId: plan.platform === 'pancake' ? plan.externalOrderId : undefined,
      shopifyOrderId: plan.platform === 'shopify' ? plan.externalOrderId : undefined,
      pancakeStatus: plan.platform === 'pancake' ? plan.statusCode : undefined,
      pancakeStatusDescription:
        plan.platform === 'pancake' ? plan.statusDescription : undefined,
      shopifyStatus:
        plan.platform === 'shopify'
          ? this.shopifyStatusForPlan(plan, existingMapping?.shopifyStatus)
          : undefined,
      sapoStatus: currentSapoOrder?.status ?? undefined,
      sapoPackedStatus: currentSapoOrder?.packed_status ?? undefined,
      sapoFulfillmentStatus: currentSapoOrder?.fulfillment_status ?? undefined,
      sapoReceivedStatus: currentSapoOrder?.received_status ?? undefined,
      sapoPaymentStatus: currentSapoOrder?.payment_status ?? undefined,
      sapoReturnStatus: currentSapoOrder?.return_status ?? undefined,
    };
    await this.prisma.orderMapping.upsert({
      where,
      create: data,
      update: data,
    } as any);
  }

  private shopifyStatusForPlan(
    plan: OrderWebhookProcessingPlan,
    existingStatus: string | null | undefined,
  ): string {
    if (plan.statusDescription === 'SHOPIFY_CANCELLED') {
      return 'CANCELLED';
    }

    return existingStatus ?? plan.statusDescription;
  }

  private async fetchSapoOrder(orderId: string): Promise<Record<string, any>> {
    const response = await this.sapoClient.fetchOrder(orderId);
    return this.objectPayload(response.order);
  }

  private async verifyPancakeSapoShippingAddress(
    plan: OrderWebhookProcessingPlan,
    payload: Record<string, any>,
    sapoOrderId: string,
    sapoOrder: Record<string, any>,
  ): Promise<void> {
    if (plan.platform !== 'pancake') {
      return;
    }

    const expected = this.pancakeAddress(payload);
    const actual = this.objectPayload(
      sapoOrder.shipping_address ?? sapoOrder.shippingAddress,
    );
    const customerData = this.objectPayload(
      sapoOrder.customer_data ?? sapoOrder.customerData,
    );
    const shipmentMismatches = this.fulfillments(sapoOrder).flatMap((fulfillment) => {
      const shipment = this.objectPayload(fulfillment.shipment);
      const shipmentAddress = this.objectPayload(
        shipment.shipping_address ?? shipment.shippingAddress,
      );

      return [
        this.shippingFieldMismatch(
          'shipment_full_name',
          expected.full_name,
          shipmentAddress.full_name,
        ),
        this.shippingFieldMismatch(
          'shipment_phone_number',
          expected.phone_number,
          shipmentAddress.phone_number,
          true,
        ),
        this.shippingFieldMismatch(
          'shipment_address',
          expected.full_address ?? expected.address1,
          shipmentAddress.full_address ?? shipmentAddress.address1,
        ),
      ].filter((entry): entry is string => entry !== null);
    });
    const mismatches = [
      this.shippingFieldMismatch('full_name', expected.full_name, actual.full_name),
      this.shippingFieldMismatch(
        'phone_number',
        expected.phone_number,
        actual.phone_number,
        true,
      ),
      this.shippingFieldMismatch(
        'address',
        expected.full_address ?? expected.address1,
        actual.full_address ?? actual.address1,
      ),
      ...shipmentMismatches,
    ].filter((entry): entry is string => entry !== null);

    if (mismatches.length === 0) {
      return;
    }

    const message = [
      `pancakeOrderId=${plan.externalOrderId ?? ''}`,
      `sapoOrderId=${sapoOrderId}`,
      `mismatches=${mismatches.join(', ')}`,
      `expectedName=${expected.full_name ?? ''}`,
      `actualName=${actual.full_name ?? ''}`,
      `expectedPhone=${expected.phone_number ?? ''}`,
      `actualPhone=${actual.phone_number ?? ''}`,
      `expectedAddress=${expected.full_address ?? expected.address1 ?? ''}`,
      `actualAddress=${actual.full_address ?? actual.address1 ?? ''}`,
      `customerCode=${customerData.code ?? ''}`,
      `customerName=${customerData.name ?? ''}`,
      'status=Sapo order was created/updated but mapping was not advanced; check Sapo receiver before retrying',
    ].join('\n');

    this.logger.error(
      `Blocked Pancake order ${plan.externalOrderId} because Sapo receiver differs from Pancake payload: ${mismatches.join(', ')}`,
    );
    await this.notifier.sendMessage(
      'Blocked Pancake -> Sapo order sync because receiver differs',
      message,
    );
    throw new Error(
      `Sapo shipping address mismatch for Pancake order ${plan.externalOrderId}: ${mismatches.join(', ')}`,
    );
  }

  private shippingFieldMismatch(
    field: string,
    expected: unknown,
    actual: unknown,
    digitsOnly = false,
  ): string | null {
    const expectedValue = digitsOnly
      ? this.normalizeDigits(expected)
      : this.normalizeComparableString(expected);
    const actualValue = digitsOnly
      ? this.normalizeDigits(actual)
      : this.normalizeComparableString(actual);

    if (!expectedValue || !actualValue || expectedValue === actualValue) {
      return null;
    }

    return field;
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

  private async shopifyAddress(payload: Record<string, any>): Promise<Record<string, any>> {
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
    const resolvedAddress = await this.resolveShopifyTextAddress({
      city: this.firstString(shipping.city, billing.city, defaultAddress.city),
      district: this.firstString(
        shipping.province,
        billing.province,
        defaultAddress.province,
      ),
      ward: this.firstString(shipping.address1, billing.address1, defaultAddress.address1),
      address1,
      full_address: address1,
    });
    const cityName = this.firstString(
      resolvedAddress.cityName,
      shipping.province,
      billing.province,
      defaultAddress.province,
      shipping.city,
      billing.city,
      defaultAddress.city,
    );
    const districtName = this.firstString(
      resolvedAddress.districtName,
      shipping.city,
      billing.city,
      defaultAddress.city,
    );
    const wardName = this.firstString(
      resolvedAddress.wardName,
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
      city: cityName,
      district: districtName,
      ward: wardName,
      address1,
      full_address: address1,
    };
  }

  private fulfillments(sapoOrder: Record<string, any>): Record<string, any>[] {
    return this.arrayPayload(sapoOrder.fulfillments);
  }

  private lastFulfillment(sapoOrder: Record<string, any>): Record<string, any> | null {
    return this.fulfillments(sapoOrder).at(-1) ?? null;
  }

  private lastFulfillmentId(sapoOrder: Record<string, any>): string | null {
    return this.fulfillmentId(this.lastFulfillment(sapoOrder));
  }

  private fulfillmentId(fulfillment: Record<string, any> | null): string | null {
    return fulfillment?.id === undefined || fulfillment.id === null
      ? null
      : String(fulfillment.id);
  }

  private isFulfillmentCancelled(fulfillment: Record<string, any> | null): boolean {
    if (!fulfillment) {
      return false;
    }

    return [
      fulfillment.status,
      fulfillment.composite_fulfillment_status,
      fulfillment.compositeFulfillmentStatus,
      fulfillment.pushing_status,
      fulfillment.pushingStatus,
    ]
      .map((value) => String(value ?? '').toLowerCase())
      .some((value) => value.includes('cancel'));
  }

  private fulfillmentCancellationPayload(
    fulfillment: Record<string, any>,
    action: 'cancel' | 'receive',
  ): Record<string, any> {
    const statusBeforeCancellation = 'fulfilled';
    const compositeStatus =
      action === 'cancel'
        ? 'fulfilled_cancelling'
        : 'fulfilled_cancelled';
    const payloadFulfillment = this.sapoFulfillmentPayloadFields(fulfillment);

    return {
      fulfillment: {
        ...payloadFulfillment,
        status: action === 'cancel' ? 'cancelling' : 'cancelled',
        composite_fulfillment_status: compositeStatus,
        status_before_cancellation: statusBeforeCancellation,
        pushing_status: action === 'cancel' ? 'cancelled_pushed' : 'completed',
      },
    };
  }

  private sapoFulfillmentPayloadFields(
    fulfillment: Record<string, any>,
  ): Record<string, any> {
    return {
      id: fulfillment.id,
      tenant_id: fulfillment.tenant_id,
      stock_location_id: fulfillment.stock_location_id,
      code: fulfillment.code,
      order_id: fulfillment.order_id,
      account_id: fulfillment.account_id,
      assignee_id: fulfillment.assignee_id,
      partner_id: fulfillment.partner_id,
      billing_address: fulfillment.billing_address,
      shipping_address: fulfillment.shipping_address,
      delivery_type: fulfillment.delivery_type,
      tax_treatment: fulfillment.tax_treatment,
      discount_rate: fulfillment.discount_rate,
      discount_value: fulfillment.discount_value,
      discount_amount: fulfillment.discount_amount,
      total: fulfillment.total,
      total_tax: fulfillment.total_tax,
      total_discount: fulfillment.total_discount,
      notes: fulfillment.notes,
      packed_on: fulfillment.packed_on,
      received_on: fulfillment.received_on,
      shipped_on: fulfillment.shipped_on,
      cancel_date: fulfillment.cancel_date,
      cancel_account_id: fulfillment.cancel_account_id,
      created_on: fulfillment.created_on,
      modified_on: fulfillment.modified_on,
      print_status: fulfillment.print_status,
      payment_status: fulfillment.payment_status,
      stock_out_account_id: fulfillment.stock_out_account_id,
      receive_account_id: fulfillment.receive_account_id,
      receive_cancellation_account_id: fulfillment.receive_cancellation_account_id,
      receive_cancellation_on: fulfillment.receive_cancellation_on,
      fulfillment_line_items: fulfillment.fulfillment_line_items,
      shipment: fulfillment.shipment,
      payments: fulfillment.payments,
      total_quantity: fulfillment.total_quantity,
      reason_cancel_id: fulfillment.reason_cancel_id,
      bill_of_lading_on: fulfillment.bill_of_lading_on,
      packed_processing_account_id: fulfillment.packed_processing_account_id,
      bill_of_lading_account_id: fulfillment.bill_of_lading_account_id,
      late_pickup_date: fulfillment.late_pickup_date,
      late_delivery_date: fulfillment.late_delivery_date,
    };
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
      const normalized = value === null || value === undefined ? '' : String(value).trim();
      if (normalized !== '') {
        return normalized;
      }
    }

    return null;
  }

  private normalizedSku(...values: unknown[]): string | null {
    const sku = this.firstString(...values);
    const normalized = normalizeSku(sku);
    return normalized === '' ? null : normalized;
  }

  private async findSapoLineItem(
    sapoLineItems: Record<string, any>[],
    sku: string | null,
  ): Promise<Record<string, any> | null> {
    if (!sku) {
      return null;
    }

    const exactSkuLine = sapoLineItems.find((line) => this.normalizedSku(line.sku) === sku);
    if (exactSkuLine) {
      return exactSkuLine;
    }

    const mapping = await this.prisma.productMapping.findUnique({
      where: { sku },
      select: { sapoVariantId: true, sapoProductId: true },
    });
    const mappedVariantId = this.firstString(mapping?.sapoVariantId);
    const mappedProductId = this.firstString(mapping?.sapoProductId);

    return (
      sapoLineItems.find((line) => {
        const lineVariantId = this.firstString(
          line.variant_id,
          line.variantId,
          line.product_variant_id,
          line.productVariantId,
        );
        const lineProductId = this.firstString(
          line.product_id,
          line.productId,
          line.sapo_product_id,
          line.sapoProductId,
        );

        return (
          (mappedVariantId !== null && lineVariantId === mappedVariantId) ||
          (mappedProductId !== null && lineProductId === mappedProductId)
        );
      }) ?? null
    );
  }

  private normalizeComparableString(value: unknown): string | null {
    const normalized = this.firstString(value)
      ?.toLowerCase()
      .replace(/\s+/g, ' ');

    return normalized && normalized.length > 0 ? normalized : null;
  }

  private normalizeDigits(value: unknown): string | null {
    const normalized = this.firstString(value)?.replace(/\D+/g, '');
    return normalized && normalized.length > 0 ? normalized : null;
  }

  private requiredString(value: unknown, label: string): string {
    const normalized = this.firstString(value);
    if (!normalized) {
      throw new Error(`${label} is required`);
    }

    return normalized;
  }

  private async resolveSenderAddress(
    warehouse: Record<string, any>,
  ): Promise<{ provinceId: number | null; districtId: number | null; wardId: number | null; wardName: string | null }> {
    const warehouseProvinceId = this.numberValue(
      warehouse.province_id ?? warehouse.provinceId,
    );
    const warehouseDistrictId = this.numberValue(
      warehouse.district_id ?? warehouse.districtId,
    );
    const warehouseWardId = this.numberValue(
      warehouse.commune_id ?? warehouse.communeId,
    );

    if (warehouseProvinceId || warehouseDistrictId || warehouseWardId) {
      return this.addressMappingService.resolvePancakeAddress({
        provinceId: warehouseProvinceId,
        districtId: warehouseDistrictId,
        wardId: warehouseWardId,
        fallbackProvinceId: warehouseProvinceId,
        fallbackDistrictId: warehouseDistrictId,
        fallbackWardId: warehouseWardId,
        fallbackFullAddress: this.firstString(
          warehouse.full_address,
          warehouse.fullAddress,
        ),
        fallbackWardName: null,
      });
    }

    return {
      provinceId: this.configNumber('shipping.sender.provinceId', 2),
      districtId: this.configNumber('shipping.sender.districtId', 55),
      wardId: this.configNumber('shipping.sender.wardId', 0) || null,
      wardName: null,
    };
  }

  private requiredAddressId(value: unknown, label: string): number {
    const parsed = this.numberValue(value);
    if (!parsed || parsed <= 0) {
      throw new Error(`Missing Sapo address mapping for ${label}`);
    }

    return parsed;
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

  private configRecord(key: string): Record<string, string> {
    const value = this.configService.get<unknown>(key);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).map(([recordKey, recordValue]) => [
        recordKey,
        String(recordValue),
      ]),
    );
  }
}
