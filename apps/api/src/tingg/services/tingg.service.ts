import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderPaymentService } from 'src/order-payment/order-payment.service';
import { OrderPaymentStatus, OrderPaymentType } from 'src/order-payment/order-payment.types';
import { OrderService } from 'src/order/services/order.service';
import { TinggSdk } from '../sdk/tingg.sdk';

@Injectable()
export class TinggService {
  private readonly logger = new Logger(TinggService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly orderService: OrderService,
    private readonly orderPaymentService: OrderPaymentService,
    private readonly tinggSdk: TinggSdk,
  ) {}

  private get serviceCode(): string {
    const value = this.config.get<string>('TINGG_SERVICE_CODE');
    if (!value) throw new BadRequestException('Missing TINGG_SERVICE_CODE');
    return value;
  }

  private get callbackUrl(): string {
    const value = this.config.get<string>('TINGG_CALLBACK_URL');
    if (!value) throw new BadRequestException('Missing TINGG_CALLBACK_URL');
    return value;
  }

  private get successRedirectUrl(): string {
    const value = this.config.get<string>('TINGG_SUCCESS_REDIRECT_URL');
    if (!value) throw new BadRequestException('Missing TINGG_SUCCESS_REDIRECT_URL');
    return value;
  }

  private get failRedirectUrl(): string {
    const value = this.config.get<string>('TINGG_FAIL_REDIRECT_URL');
    if (!value) throw new BadRequestException('Missing TINGG_FAIL_REDIRECT_URL');
    return value;
  }

  async createExpressCheckout(input: {
    orderId: string;
    amount: number;
    currency: string;
    phone: string;
    firstName: string;
    lastName: string;
    email?: string;
  }) {
    const accessToken = await this.tinggSdk.getAccessToken();

    const payload = {
      customer_first_name: input.firstName,
      customer_last_name: input.lastName,
      msisdn: input.phone,
      account_number: input.orderId,
      request_amount: String(Math.round(input.amount)),
      merchant_transaction_id: input.orderId,
      service_code: this.serviceCode,
      country_code: 'KEN',
      currency_code: input.currency,
      callback_url: this.callbackUrl,
      success_redirect_url: this.successRedirectUrl,
      fail_redirect_url: this.failRedirectUrl,
      customer_email: input.email,
      request_description: `Order ${input.orderId}`,
    };

    return this.tinggSdk.createExpressCheckout({ token: accessToken, payload });
  }

  async handleCallback(body: any) {
    const orderId = String(body?.merchant_transaction_id || '').trim();
    if (!orderId) return;

    let order:
      | Awaited<ReturnType<OrderService['findOneHydrated']>>
      | null = null;
    try {
      order = await this.orderService.findOneHydrated(orderId);
    } catch {
      return;
    }
    if (!order) return;

    const statusCode = String(body?.request_status_code || '').trim();
    const amountPaid = Number(body?.amount_paid || 0);
    const currency = String(body?.currency_code || order.currencyCode || '').trim();

    if (statusCode === '178' || statusCode === '177') {
      await this.orderPaymentService.createForOrder(orderId, {
        amount: amountPaid,
        currency: currency || order.currencyCode,
        provider: 'CELLULANT',
        method: 'TINGG',
        type: OrderPaymentType.CAPTURE,
        status: OrderPaymentStatus.SUCCEEDED,
        externalRef: String(body?.checkout_request_id || ''),
        metaJson: {
          tingg: body,
        },
      });
    } else if (statusCode) {
      await this.orderPaymentService.createForOrder(orderId, {
        amount: amountPaid || Number(order.grandTotal),
        currency: currency || order.currencyCode,
        provider: 'CELLULANT',
        method: 'TINGG',
        type: OrderPaymentType.CAPTURE,
        status: OrderPaymentStatus.FAILED,
        externalRef: String(body?.checkout_request_id || ''),
        metaJson: {
          tingg: body,
        },
      });
    }
  }
}
