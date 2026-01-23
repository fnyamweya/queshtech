import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FindManyOptions } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderLevelCharge } from '../entities/order-level-charge.entity';
import { CreateOrderDto } from '../dto/create-order.dto';
import { PriceService } from '../../catalog/services/price.service';
import { PriceList } from '../../catalog/entities/price-list.entity';
import { TaxService } from './tax.service';
import { ShippingMatrixService } from '../../shipping/services/shipping-matrix.service';
import { OrderShippingAddress } from '../entities/order-shipping-address.entity';
import { User } from '../../user/entities/user.entity';
import { Location } from '../../location/entities/location.entity';
import { CurrencyService } from 'src/currency/currency.service';
import { CustomerShippingAddressService } from '../../customer-shipping-address/services/customer-shipping-address.service';
import { ConfigService } from '@nestjs/config';
import { OrderNotificationService } from './order-notification.service';
import { randomUUID } from 'crypto';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PriceList)
    private readonly priceListRepository: Repository<PriceList>,
    @InjectRepository(OrderLevelCharge)
    private readonly orderLevelChargeRepository: Repository<OrderLevelCharge>,
    @InjectRepository(OrderShippingAddress)
    private readonly orderShippingAddressRepository: Repository<OrderShippingAddress>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    private readonly priceService: PriceService,
    private readonly shippingMatrixService: ShippingMatrixService,
    private readonly taxService: TaxService,
    private readonly currencyService: CurrencyService,
    private readonly customerShippingAddressService: CustomerShippingAddressService,
    private readonly configService: ConfigService,
    private readonly orderNotificationService: OrderNotificationService,
  ) {}

  private async ensureInvoiceToken(order: Order): Promise<string> {
    const meta: any = order.metaJson ?? {};
    if (meta.invoiceToken) return String(meta.invoiceToken);

    const token = randomUUID();
    order.metaJson = { ...meta, invoiceToken: token };
    await this.orderRepository.save(order);
    return token;
  }

  private buildPublicBaseUrl(): string {
    const raw = this.configService.get<string>('APP_URL') || '';
    return raw.replace(/\/+$/, '');
  }

  private buildCustomerBaseUrl(): string {
    const raw =
      this.configService.get<string>('CUSTOMER_APP_URL') ||
      this.configService.get<string>('APP_URL') ||
      '';
    return raw.replace(/\/+$/, '');
  }

  private formatShippingAddressSummary(
    fieldsJson?: Record<string, unknown>,
  ): string | undefined {
    if (!fieldsJson || typeof fieldsJson !== 'object') return undefined;
    const fields = fieldsJson as Record<string, unknown>;
    const keys = [
      'address1',
      'address2',
      'line1',
      'line2',
      'street',
      'street2',
      'city',
      'state',
      'region',
      'province',
      'postalCode',
      'postal',
      'zip',
      'district',
      'landmark',
    ];
    const parts: string[] = [];
    for (const key of keys) {
      const value = fields[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed && !parts.includes(trimmed)) parts.push(trimmed);
      }
    }
    return parts.length ? parts.join(', ') : undefined;
  }

  async getInvoiceLinks(order: Order): Promise<{
    token: string;
    invoiceUrl: string;
    pdfUrl: string;
    paymentUrl: string;
  }> {
    const token = await this.ensureInvoiceToken(order);
    const apiBase = this.buildPublicBaseUrl();
    const customerBase = this.buildCustomerBaseUrl();
    const invoiceUrl = `${apiBase}/api/v1/orders/${order.id}/invoice?token=${encodeURIComponent(token)}`;
    const pdfUrl = `${apiBase}/api/v1/orders/${order.id}/invoice.pdf?token=${encodeURIComponent(token)}`;
    const paymentUrl = `${customerBase}/pay/${order.id}?token=${encodeURIComponent(token)}`;
    return { token, invoiceUrl, pdfUrl, paymentUrl };
  }

  assertInvoiceToken(order: Order, token: string): void {
    const meta: any = order.metaJson ?? {};
    const expected = String(meta.invoiceToken || '').trim();
    if (!expected || expected !== String(token || '').trim()) {
      throw new BadRequestException('Invalid invoice token');
    }
  }

  async create(payload: CreateOrderDto) {
    // Resolve customer identity (orders store email/name snapshot for reporting/receipts)
    const customer = await this.userRepository.findOne({
      where: { id: payload.customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (!customer.email)
      throw new BadRequestException('Customer email is missing');

    // Customer shipping address is editable/reusable and is snapshotted onto the order (immutable).
    // If shippingAddress is provided at checkout, we upsert it into the customer's shipping address.
    let customerShippingAddress = await this.customerShippingAddressService
      .getOptionalForUser(payload.customerId)
      .catch(() => null);

    if (payload.shippingAddress) {
      if (!payload.shippingAddress.locationId) {
        throw new BadRequestException('shippingAddress.locationId is required');
      }
      customerShippingAddress =
        await this.customerShippingAddressService.upsertForUser(
          payload.customerId,
          payload.shippingAddress,
        );
    }

    // Backward-compat: if the client only provides shippingLocationId and the customer has no shipping address yet,
    // create a minimal customer shipping address so it can be reused/edited later.
    if (!customerShippingAddress && payload.shippingLocationId) {
      const loc = await this.locationRepository.findOne({
        where: { id: payload.shippingLocationId },
        select: { id: true, countryCode: true } as any,
      });

      if (!loc?.countryCode) {
        throw new BadRequestException('Invalid shippingLocationId');
      }

      customerShippingAddress =
        await this.customerShippingAddressService.upsertForUser(
          payload.customerId,
          {
            countryCode: String(loc.countryCode).toUpperCase(),
            locationId: payload.shippingLocationId,
          } as any,
        );
    }

    const shippingAddress = customerShippingAddress?.address;
    if (shippingAddress && !shippingAddress.locationId) {
      throw new BadRequestException(
        'Customer shipping address must include locationId',
      );
    }

    const resolvedShippingLocationId: string | undefined =
      shippingAddress?.locationId ?? payload.shippingLocationId;

    const shippingSnapshot = shippingAddress
      ? {
          firstName: shippingAddress.firstName ?? customer.firstName,
          lastName: shippingAddress.lastName ?? customer.lastName,
          phone: shippingAddress.phone ?? (customer as any).phone,
          countryCode: shippingAddress.countryCode,
          locationId: shippingAddress.locationId,
          fieldsJson: shippingAddress.fieldsJson ?? {},
        }
      : undefined;

    const shippingName = shippingSnapshot
      ? [shippingSnapshot.firstName, shippingSnapshot.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() || undefined
      : undefined;
    const shippingPhone = shippingSnapshot?.phone
      ? String(shippingSnapshot.phone).trim() || undefined
      : undefined;
    const shippingAddressSummary = shippingSnapshot
      ? this.formatShippingAddressSummary(shippingSnapshot.fieldsJson)
      : undefined;

    // Resolve price list if provided
    let priceList: PriceList | null = null;
    if (payload.priceListId) {
      priceList = await this.priceListRepository.findOne({
        where: { id: payload.priceListId },
      });
      if (!priceList) {
        throw new NotFoundException('Price list not found');
      }
    }

    let resolvedPriceList: PriceList | null = priceList;
    if (!resolvedPriceList) {
      const defaultCurrency =
        await this.currencyService.getDefaultCurrencyCode();
      resolvedPriceList =
        await this.priceService.findActivePriceListByCurrency(defaultCurrency);

      if (!resolvedPriceList) {
        resolvedPriceList = await this.priceListRepository.findOne({
          where: { status: 'active' as any },
          order: { priority: 'DESC' as any, createdAt: 'DESC' as any },
        });
      }

      if (!resolvedPriceList) {
        throw new NotFoundException('No active price list available');
      }
    }

    const order = this.orderRepository.create({
      orderNumber: await this.generateOrderNumber(),
      customerId: payload.customerId,
      customerEmail: customer.email,
      customerName:
        [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
        undefined,
      shippingName,
      shippingPhone,
      shippingAddressSummary,
      priceListId: resolvedPriceList.id,
      currencyCode: await this.currencyService.assertExists(
        resolvedPriceList.currency,
      ),
      status: OrderStatus.DRAFT, // Orders start as DRAFT until pricing is locked at checkout
      itemsSubtotal: '0',
      discountTotal: '0',
      feeTotal: '0',
      taxTotal: '0',
      shippingSubtotal: '0',
      shippingDiscount: '0',
      shippingTax: '0',
      shippingTotal: '0',
      grandTotal: '0',
      itemCount: 0,
      metaJson: {},
    });

    const savedOrder = await this.orderRepository.save(order);

    const pricingContext = resolvedShippingLocationId
      ? {
          countryCode: (
            await this.locationRepository.findOne({
              where: { id: resolvedShippingLocationId },
              select: { id: true, countryCode: true },
            })
          )?.countryCode,
        }
      : undefined;

    // Persist an order-level shipping snapshot (so the order is immutable even if the customer address changes).
    if (shippingSnapshot || resolvedShippingLocationId) {
      await this.orderShippingAddressRepository.save(
        this.orderShippingAddressRepository.create({
          orderId: savedOrder.id,
          firstName: shippingSnapshot?.firstName,
          lastName: shippingSnapshot?.lastName,
          phone: shippingSnapshot?.phone,
          countryCode: shippingSnapshot?.countryCode,
          locationId:
            shippingSnapshot?.locationId ?? resolvedShippingLocationId,
          fieldsJson: shippingSnapshot?.fieldsJson ?? {},
        }),
      );
    }

    let itemsSubtotal = 0;
    let totalItemCount = 0;

    for (const item of payload.orderItems) {
      const resolved = await this.priceService.resolveSkuPrice({
        productSkuId: item.productSkuId,
        priceListId: priceList?.id ?? savedOrder.priceListId,
        currencyCode: savedOrder.currencyCode,
        quantity: item.quantity,
        context: pricingContext,
      });

      const unitPrice = parseFloat(resolved.unitPrice);
      const baseSubtotal = unitPrice * item.quantity;

      itemsSubtotal += baseSubtotal;
      totalItemCount += item.quantity;

      const orderItem = this.orderItemRepository.create({
        orderId: savedOrder.id,
        productSkuId: item.productSkuId,
        sku: item.sku,
        quantity: item.quantity,
        requiresShipping: item.requiresShipping ?? true,
      });

      await this.orderItemRepository.save(orderItem);
    }

    savedOrder.itemsSubtotal = itemsSubtotal.toFixed(4);
    savedOrder.itemCount = totalItemCount;

    // Shipping calculation using the ShippingMatrixService (select best candidate)
    const totalWeight = 0;

    const quotes = resolvedShippingLocationId
      ? await this.shippingMatrixService.getQuotes({
          locationId: resolvedShippingLocationId,
          subtotal: itemsSubtotal,
          totalWeight,
          itemCount: totalItemCount,
          currencyCode: savedOrder.currencyCode,
          channelCode: savedOrder.salesChannelCode,
          allowedMethodCodes: [],
          excludedMethodCodes: [],
          ratePriorityBoost: 0,
          productIds: [],
          categoryIds: [],
          taxonomyIds: [],
        })
      : [];

    let best = quotes[0];
    if (payload.shippingMethodCode) {
      const code = String(payload.shippingMethodCode).trim();
      const candidates = quotes.filter((q) => q.method?.code === code);
      if (!candidates.length) {
        throw new BadRequestException(
          'Selected shipping method is not available for this destination',
        );
      }

      candidates.sort(
        (a, b) =>
          (b.effectivePriority ?? 0) - (a.effectivePriority ?? 0) ||
          (a.amount ?? 0) - (b.amount ?? 0),
      );
      best = candidates[0];
    }
    const shippingFee = best ? best.amount : 0;
    const isNegotiatedMethod = Boolean(
      best &&
        (best.method?.code === 'internal_negotiated' ||
          (best.rate?.metaJson as any)?.negotiated),
    );

    if (shippingFee !== 0) {
      const shippingCharge = this.orderLevelChargeRepository.create({
        orderId: savedOrder.id,
        chargeKind: 'shipping',
        displayName: best ? best.method.displayName : 'Shipping',
        calculationType: best ? best.rate.calculationType : 'fixed',
        baseAmount: savedOrder.itemsSubtotal,
        amount: shippingFee.toFixed(4),
        isIncludedInPrice: false,
        appliesToShipping: true,
        sourceType: 'shipping',
        sourceReference: best ? best.method.code : undefined,
        metaJson: best
          ? {
              methodId: best.method.id,
              rateId: best.rate.id,
              meta: best.rate.metaJson,
            }
          : {},
      });
      await this.orderLevelChargeRepository.save(shippingCharge);
    }

    savedOrder.shippingSubtotal = shippingFee.toFixed(4);
    savedOrder.discountTotal = '0';
    savedOrder.shippingDiscount = '0';
    savedOrder.feeTotal = '0';
    savedOrder.taxTotal = '0';
    savedOrder.shippingTax = '0';
    savedOrder.shippingTotal = shippingFee.toFixed(4);
    savedOrder.grandTotal = (itemsSubtotal + shippingFee).toFixed(4);

    // Pricing artifacts will compute tax + discounts in the pricing pipeline.
    const shippingNet = Math.max(0, shippingFee);

    if (isNegotiatedMethod) {
      savedOrder.status = OrderStatus.AWAITING_SHIPPING_QUOTE;
      savedOrder.shippingQuotePending = true;
    }

    const updated = await this.orderRepository.save(savedOrder);

    // Return hydrated order so clients can see item charges + order level charges in one response.
    const hydrated = await this.orderRepository.findOne({
      where: { id: updated.id },
      relations: ['items', 'orderLevelCharges'],
    } as any);

    return hydrated ?? updated;
  }

  async applyShippingQuote(input: {
    orderId: string;
    amount: number;
    currencyCode?: string;
    note?: string;
    sendNotifications?: boolean;
  }) {
    const order = await this.orderRepository.findOne({
      where: { id: input.orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const amount = Number(input.amount || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Invalid shipping quote amount');
    }

    if (input.currencyCode) {
      const normalized = await this.currencyService.assertExists(
        input.currencyCode,
      );
      if (normalized !== order.currencyCode) {
        throw new BadRequestException('Quote currency does not match order');
      }
    }

    const itemsSubtotal = Number(order.itemsSubtotal || 0);
    const discountTotal = Number(order.discountTotal || 0);
    const shippingDiscount = Number(order.shippingDiscount || 0);
    const itemTaxTotal = Number(order.taxTotal || 0);

    const shippingNet = Math.max(0, amount - shippingDiscount);
    const taxable = Math.max(0, itemsSubtotal - discountTotal + shippingNet);
    const taxResult = await this.taxService.calculateTax({
      taxableAmount: taxable,
      currencyCode: order.currencyCode,
    });

    let totalTax = Number(taxResult.amount || 0);
    if (totalTax < itemTaxTotal) totalTax = itemTaxTotal;
    const shippingTax = Math.max(0, totalTax - itemTaxTotal);

    order.shippingSubtotal = amount.toFixed(4);
    order.shippingTax = shippingTax.toFixed(4);
    order.shippingTotal = (shippingNet + shippingTax).toFixed(4);
    order.grandTotal = (
      itemsSubtotal -
      discountTotal +
      shippingNet +
      totalTax
    ).toFixed(4);
    order.status = OrderStatus.READY_FOR_PAYMENT;
    order.shippingQuotePending = false;

    const meta: any = order.metaJson ?? {};
    const quotedAt = new Date().toISOString();
    order.metaJson = {
      ...meta,
      shippingQuote: {
        amount: amount.toFixed(4),
        currency: order.currencyCode,
        note: input.note || undefined,
        quotedAt,
      },
    };

    await this.orderRepository.save(order);

    await this.orderLevelChargeRepository.save(
      this.orderLevelChargeRepository.create({
        orderId: order.id,
        chargeKind: 'shipping',
        displayName: 'Shipping Quote',
        calculationType: 'fixed',
        baseAmount: order.itemsSubtotal,
        amount: amount.toFixed(4),
        isIncludedInPrice: false,
        appliesToShipping: true,
        sourceType: 'shipping_quote',
        sourceReference: 'admin',
        metaJson: {
          note: input.note || undefined,
          quotedAt,
        },
      }),
    );

    if (shippingTax > 0) {
      await this.orderLevelChargeRepository.save(
        this.orderLevelChargeRepository.create({
          orderId: order.id,
          chargeKind: 'tax',
          displayName: 'Shipping Tax',
          calculationType: taxResult.rate ? 'percentage' : 'fixed',
          rate: (taxResult.rate || 0).toFixed(6) as any,
          baseAmount: shippingNet.toFixed(4),
          amount: shippingTax.toFixed(4),
          isIncludedInPrice: false,
          appliesToShipping: true,
          sourceType: 'tax',
          metaJson: taxResult.meta || {},
        }),
      );
    }

    const sendNotifications = input.sendNotifications !== false;
    if (sendNotifications) {
      const links = await this.getInvoiceLinks(order);
      await this.orderNotificationService.sendInvoiceReady({
        order,
        invoiceUrl: links.invoiceUrl,
        paymentUrl: links.paymentUrl,
        pdfUrl: links.pdfUrl,
      });
    }

    return this.findOneHydrated(order.id);
  }

  async findAndCount(options: FindManyOptions<Order>) {
    return this.orderRepository.findAndCount(options);
  }

  async findOneHydrated(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items', 'orderLevelCharges'],
    } as any);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async generateOrderNumber() {
    // Simple generator for now, in real system use a robust sequence
    const seq = Math.floor(Math.random() * 1000000);
    return `ORD-${Date.now()}-${seq}`;
  }
}
