import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderPaymentService } from 'src/order-payment/order-payment.service';
import { OrderPaymentStatus, OrderPaymentType } from 'src/order-payment/order-payment.types';
import { Order } from 'src/order/entities/order.entity';
import { OrderPayment } from 'src/order-payment/entities/order-payment.entity';
import { PaystackSdk } from '../sdk/paystack.sdk';

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly paystackSdk: PaystackSdk,
    private readonly orderPaymentService: OrderPaymentService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderPayment)
    private readonly paymentRepo: Repository<OrderPayment>,
  ) {}

  private get webhookSecret(): string | undefined {
    const value = this.config.get<string>('PAYSTACK_WEBHOOK_SECRET');
    return value?.trim() || undefined;
  }

  private async getOrderOrThrow(orderId: string, userId?: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (userId && order.customerId && order.customerId !== userId) {
      throw new UnauthorizedException('Order does not belong to user');
    }
    return order;
  }

  private asAmount(value: string): number {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 0;
    return amount;
  }

  async initializeTransaction(input: {
    orderId: string;
    email: string;
    amount: number;
    currency: string;
    reference: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.paystackSdk.initializeTransaction({
      email: input.email,
      amount: input.amount,
      currency: input.currency,
      reference: input.reference,
      metadata: input.metadata ?? {},
    });
  }

  async verifyTransaction(reference: string) {
    return this.paystackSdk.verifyTransaction(reference);
  }

  async initializeForOrder(orderId: string, userId?: string) {
    const order = await this.getOrderOrThrow(orderId, userId);
    const email = order.customerEmail;
    if (!email) throw new BadRequestException('Order email is missing');

    const amount = this.asAmount(order.grandTotal);
    if (!amount) throw new BadRequestException('Order total is invalid');

    const reference = order.orderNumber;

    return this.initializeTransaction({
      orderId: order.id,
      email,
      amount,
      currency: order.currencyCode,
      reference,
      metadata: { orderId: order.id, orderNumber: order.orderNumber, userId: order.customerId },
    });
  }

  private async recordSuccessfulPayment(opts: {
    order: Order;
    amount: number;
    currency: string;
    reference: string;
    raw: Record<string, unknown>;
  }) {
    const existing = await this.paymentRepo.findOne({
      where: { externalRef: opts.reference },
    });
    if (existing && existing.status === OrderPaymentStatus.SUCCEEDED) return;

    await this.orderPaymentService.createForOrder(opts.order.id, {
      amount: opts.amount,
      currency: opts.currency,
      provider: 'PAYSTACK',
      method: 'PAYSTACK',
      type: OrderPaymentType.CAPTURE,
      status: OrderPaymentStatus.SUCCEEDED,
      externalRef: opts.reference,
      metaJson: { paystack: opts.raw },
    });

    await this.orderRepo.update(
      { id: opts.order.id } as any,
      {
        financialStatus: 'paid',
        status: 'confirmed',
        confirmedAt: new Date(),
      } as any,
    );
  }

  async confirm(reference: string) {
    const verify = await this.verifyTransaction(reference);
    const data = verify?.data || {};
    const status = String(data.status || '').toLowerCase();
    const orderId = String(data.metadata?.orderId || '').trim();
    if (!orderId) throw new BadRequestException('Order id missing in metadata');

    const order = await this.getOrderOrThrow(orderId);
    const amountPaid = Number(data.amount || 0) / 100;
    const currency = String(data.currency || order.currencyCode || '').trim();

    if (status === 'success') {
      const expected = this.asAmount(order.grandTotal);
      if (expected && amountPaid && Math.round(expected * 100) !== Math.round(amountPaid * 100)) {
        throw new BadRequestException('Paystack amount mismatch');
      }

      await this.recordSuccessfulPayment({
        order,
        amount: amountPaid,
        currency: currency || order.currencyCode,
        reference: data.reference || reference,
        raw: data,
      });
    }

    return { status, reference: data.reference || reference };
  }

  validateWebhookSignature(body: Buffer, signature?: string) {
    const secret = this.webhookSecret;
    if (!secret) {
      this.logger.warn('PAYSTACK_WEBHOOK_SECRET not set; skipping signature verification');
      return;
    }
    if (!signature) throw new UnauthorizedException('Missing paystack signature');
    const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');
    if (hash !== signature) {
      throw new UnauthorizedException('Invalid paystack signature');
    }
  }

  async handleWebhook(event: any) {
    if (!event || typeof event !== 'object') return;
    if (event.event !== 'charge.success') return;
    const data = event.data || {};
    const reference = String(data.reference || '').trim();
    if (!reference) return;

    const orderId = String(data.metadata?.orderId || '').trim();
    if (!orderId) return;
    const order = await this.getOrderOrThrow(orderId);

    const amountPaid = Number(data.amount || 0) / 100;
    const currency = String(data.currency || order.currencyCode || '').trim();

    await this.recordSuccessfulPayment({
      order,
      amount: amountPaid,
      currency: currency || order.currencyCode,
      reference,
      raw: data,
    });
  }
}
