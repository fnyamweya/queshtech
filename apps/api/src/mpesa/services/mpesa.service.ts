import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getDarajaBaseUrl } from '../mpesa.config';
import { C2BRegisterUrlsDto } from '../dto/c2b-register-urls.dto';
import { C2BSimulateDto } from '../dto/c2b-simulate.dto';
import { B2CPaymentRequestDto } from '../dto/b2c-payment-request.dto';
import { B2BPaymentRequestDto } from '../dto/b2b-payment-request.dto';
import { StkPushRequestDto } from '../dto/stk-push-request.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MpesaTransaction,
  MpesaTransactionStatus,
  MpesaTransactionType,
} from '../entities/mpesa-transaction.entity';
import { Order } from 'src/order/entities/order.entity';
import { EventBusService } from 'src/queue/event-bus.service';
import {
  ORDER_PAYMENT_SUCCEEDED_EVENT,
  OrderPaymentSucceededEventPayload,
} from 'src/order/order.events';
import { FinancialStatus, OrderStatus } from 'src/order/entities/order.entity';
import { ApiClientService } from 'src/common/api-client/api-client.service';

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);

  constructor(
    private readonly http: ApiClientService,
    private readonly config: ConfigService,
    private readonly eventBus: EventBusService,
    @InjectRepository(MpesaTransaction)
    private readonly mpesaTxRepo: Repository<MpesaTransaction>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  private get env(): 'sandbox' | 'production' {
    const value = this.config.get<string>('MPESA_DARAJA_ENV') ?? 'sandbox';
    return value === 'production' ? 'production' : 'sandbox';
  }

  private get baseUrl(): string {
    return getDarajaBaseUrl(this.env);
  }

  private get consumerKey(): string {
    const value = this.config.get<string>('MPESA_DARAJA_CONSUMER_KEY');
    if (!value)
      throw new BadRequestException('Missing MPESA_DARAJA_CONSUMER_KEY');
    return value;
  }

  private get consumerSecret(): string {
    const value = this.config.get<string>('MPESA_DARAJA_CONSUMER_SECRET');
    if (!value)
      throw new BadRequestException('Missing MPESA_DARAJA_CONSUMER_SECRET');
    return value;
  }

  private get shortcode(): string {
    const value = this.config.get<string>('MPESA_DARAJA_SHORTCODE');
    if (!value) throw new BadRequestException('Missing MPESA_DARAJA_SHORTCODE');
    return value;
  }

  private get initiatorName(): string {
    const value = this.config.get<string>('MPESA_DARAJA_INITIATOR_NAME');
    if (!value)
      throw new BadRequestException('Missing MPESA_DARAJA_INITIATOR_NAME');
    return value;
  }

  private get securityCredential(): string {
    const value = this.config.get<string>('MPESA_DARAJA_SECURITY_CREDENTIAL');
    if (!value)
      throw new BadRequestException('Missing MPESA_DARAJA_SECURITY_CREDENTIAL');
    return value;
  }

  private get callbackBaseUrl(): string {
    const value = this.config.get<string>('MPESA_DARAJA_CALLBACK_BASE_URL');
    if (!value)
      throw new BadRequestException('Missing MPESA_DARAJA_CALLBACK_BASE_URL');
    return value.replace(/\/$/, '');
  }

  private get passkey(): string {
    const value = this.config.get<string>('MPESA_DARAJA_PASSKEY');
    if (!value) throw new BadRequestException('Missing MPESA_DARAJA_PASSKEY');
    return value;
  }

  private buildCallbackUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.callbackBaseUrl}${normalizedPath}`;
  }

  private async getAccessToken(): Promise<string> {
    const basic = Buffer.from(
      `${this.consumerKey}:${this.consumerSecret}`,
    ).toString('base64');

    const url = `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`;

    try {
      const res = await this.http.request<{ access_token?: string }>({
        operation: 'mpesa.daraja.getAccessToken',
        method: 'GET',
        url,
        headers: {
          Authorization: `Basic ${basic}`,
        },
        retry: {
          attempts: 2,
        },
      });

      const token = res.data?.access_token;
      if (!token) {
        throw new InternalServerErrorException(
          'Daraja token missing in response',
        );
      }
      return token;
    } catch (error: any) {
      const status = error?.response?.status;
      const data = error?.response?.data;
      this.logger.error(
        `Failed to get Daraja token (${status ?? 'n/a'})`,
        data,
      );
      throw new InternalServerErrorException(
        'Failed to get Daraja access token',
      );
    }
  }

  private async darajaPost<T>(path: string, payload: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${path}`;

    try {
      const res = await this.http.request<T>({
        operation: `mpesa.daraja.post${path}`,
        method: 'POST',
        url,
        data: payload,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        retry: {
          // POST isn't idempotent by default; we keep attempts=1.
          attempts: 1,
        },
      });
      return res.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const data = error?.response?.data;
      const errorMessage =
        (typeof data?.errorMessage === 'string' && data.errorMessage) ||
        (typeof data?.message === 'string' && data.message) ||
        (typeof data?.ResponseDescription === 'string' && data.ResponseDescription) ||
        (typeof data?.responseDescription === 'string' && data.responseDescription) ||
        (typeof data?.errorCode === 'string' && data.errorCode) ||
        undefined;
      this.logger.error(
        `Daraja POST ${path} failed (${status ?? 'n/a'})`,
        data,
      );
      const detail = errorMessage ? `: ${errorMessage}` : '';
      if (typeof status === 'number' && status >= 400 && status < 500) {
        throw new BadRequestException({
          message: `Daraja request failed${detail}`,
          details: data ?? null,
        });
      }
      throw new InternalServerErrorException(`Daraja request failed${detail}`);
    }
  }

  private asStringRecord(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object') return {};
    return input as Record<string, unknown>;
  }

  private normalizeMsisdn(input: string): string {
    const digits = String(input || '').replace(/[^0-9]/g, '');
    if (!digits) throw new BadRequestException('Invalid phone number');
    if (digits.startsWith('254')) return digits;
    if (digits.startsWith('0')) return `254${digits.slice(1)}`;
    if (digits.length === 9) return `254${digits}`;
    return digits;
  }

  private formatTimestamp(date: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  private normalizeAccountReference(value?: string, fallback = 'Checkout'): string {
    const raw = String(value || '').trim();
    const cleaned = raw.replace(/[^0-9A-Za-z]/g, '');
    const base = cleaned || fallback;
    return base.slice(0, 12);
  }

  private normalizeTransactionDesc(value?: string, fallback = 'Checkout payment'): string {
    const raw = String(value || '').trim();
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    const base = cleaned || fallback;
    return base.slice(0, 13);
  }

  private async linkOrderByBillRef(
    billRefNumber?: string,
  ): Promise<string | undefined> {
    if (!billRefNumber) return undefined;
    const order = await this.orderRepo.findOne({
      where: { orderNumber: billRefNumber },
    });
    return order?.id;
  }

  private async findByConversation(
    conversationId?: string,
    originatorConversationId?: string,
  ) {
    if (conversationId) {
      const found = await this.mpesaTxRepo.findOne({
        where: { conversationId },
      });
      if (found) return found;
    }
    if (originatorConversationId) {
      const found = await this.mpesaTxRepo.findOne({
        where: { originatorConversationId },
      });
      if (found) return found;
    }
    return null;
  }

  private async findByCheckoutRequestId(checkoutRequestId?: string) {
    if (!checkoutRequestId) return null;
    return this.mpesaTxRepo.findOne({ where: { transactionId: checkoutRequestId } });
  }

  async registerC2BUrls(dto: C2BRegisterUrlsDto) {
    const shortCode = dto.shortCode || this.shortcode;

    const validationUrl =
      dto.validationUrl ??
      this.buildCallbackUrl('/api/v1/mpesa/c2b/validation');
    const confirmationUrl =
      dto.confirmationUrl ??
      this.buildCallbackUrl('/api/v1/mpesa/c2b/confirmation');

    const payload = {
      ShortCode: shortCode,
      ResponseType: dto.responseType ?? 'Completed',
      ConfirmationURL: confirmationUrl,
      ValidationURL: validationUrl,
    };

    const data = await this.darajaPost('/mpesa/c2b/v2/registerurl', payload);
    // Optionally persist for audit
    await this.mpesaTxRepo.save(
      this.mpesaTxRepo.create({
        type: MpesaTransactionType.C2B,
        status: MpesaTransactionStatus.PENDING,
        rawRequestJson: this.asStringRecord(payload),
        rawResponseJson: this.asStringRecord(data),
        rawCallbackJson: {},
      }),
    );
    return data;
  }

  async simulateC2B(dto: C2BSimulateDto) {
    const payload = {
      ShortCode: dto.shortCode,
      CommandID: dto.commandId ?? 'CustomerPayBillOnline',
      Amount: dto.amount,
      Msisdn: dto.msisdn,
      BillRefNumber: dto.billRefNumber,
    };

    const data = await this.darajaPost('/mpesa/c2b/v1/simulate', payload);
    await this.mpesaTxRepo.save(
      this.mpesaTxRepo.create({
        type: MpesaTransactionType.C2B,
        status: MpesaTransactionStatus.PENDING,
        amount: String(dto.amount),
        msisdn: dto.msisdn,
        billRefNumber: dto.billRefNumber,
        partyA: dto.shortCode,
        rawRequestJson: this.asStringRecord(payload),
        rawResponseJson: this.asStringRecord(data),
        rawCallbackJson: {},
      }),
    );
    return data;
  }

  async b2cPayment(dto: B2CPaymentRequestDto) {
    const initiatorName = dto.initiatorName ?? this.initiatorName;
    const securityCredential =
      dto.securityCredential ?? this.securityCredential;

    const payload = {
      InitiatorName: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: dto.commandId ?? 'BusinessPayment',
      Amount: dto.amount,
      PartyA: dto.partyA ?? this.shortcode,
      PartyB: dto.partyB,
      Remarks: dto.remarks,
      QueueTimeOutURL:
        dto.queueTimeoutUrl ??
        this.buildCallbackUrl('/api/v1/mpesa/b2c/timeout'),
      ResultURL:
        dto.resultUrl ?? this.buildCallbackUrl('/api/v1/mpesa/b2c/result'),
      Occasion: dto.occasion ?? '',
    };

    const tx = await this.mpesaTxRepo.save(
      this.mpesaTxRepo.create({
        type: MpesaTransactionType.B2C,
        status: MpesaTransactionStatus.PENDING,
        orderId: dto.orderId,
        amount: String(dto.amount),
        partyA: String(payload.PartyA),
        partyB: dto.partyB,
        remarks: dto.remarks,
        rawRequestJson: this.asStringRecord(payload),
        rawResponseJson: {},
        rawCallbackJson: {},
      }),
    );

    const data = await this.darajaPost('/mpesa/b2c/v3/paymentrequest', payload);
    const r = this.asStringRecord(data);
    tx.originatorConversationId =
      (r.OriginatorConversationID as string) ?? tx.originatorConversationId;
    tx.conversationId = (r.ConversationID as string) ?? tx.conversationId;
    tx.resultCode =
      typeof r.ResponseCode === 'string'
        ? parseInt(r.ResponseCode, 10)
        : (r.ResponseCode as any);
    tx.resultDesc =
      (r.ResponseDescription as string) ??
      (r.ResponseDesc as string) ??
      tx.resultDesc;
    tx.rawResponseJson = r;
    await this.mpesaTxRepo.save(tx);
    return data;
  }

  async b2bPayment(dto: B2BPaymentRequestDto) {
    const initiatorName = dto.initiatorName ?? this.initiatorName;
    const securityCredential =
      dto.securityCredential ?? this.securityCredential;

    const payload = {
      Initiator: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: dto.commandId ?? 'BusinessPayBill',
      Amount: dto.amount,
      PartyA: dto.partyA ?? this.shortcode,
      PartyB: dto.partyB,
      AccountReference: dto.accountReference,
      Remarks: dto.remarks,
      QueueTimeOutURL:
        dto.queueTimeoutUrl ??
        this.buildCallbackUrl('/api/v1/mpesa/b2b/timeout'),
      ResultURL:
        dto.resultUrl ?? this.buildCallbackUrl('/api/v1/mpesa/b2b/result'),
    };

    const tx = await this.mpesaTxRepo.save(
      this.mpesaTxRepo.create({
        type: MpesaTransactionType.B2B,
        status: MpesaTransactionStatus.PENDING,
        orderId: dto.orderId,
        amount: String(dto.amount),
        partyA: String(payload.PartyA),
        partyB: dto.partyB,
        accountReference: dto.accountReference,
        remarks: dto.remarks,
        rawRequestJson: this.asStringRecord(payload),
        rawResponseJson: {},
        rawCallbackJson: {},
      }),
    );

    const data = await this.darajaPost('/mpesa/b2b/v1/paymentrequest', payload);
    const r = this.asStringRecord(data);
    tx.originatorConversationId =
      (r.OriginatorConversationID as string) ?? tx.originatorConversationId;
    tx.conversationId = (r.ConversationID as string) ?? tx.conversationId;
    tx.resultCode =
      typeof r.ResponseCode === 'string'
        ? parseInt(r.ResponseCode, 10)
        : (r.ResponseCode as any);
    tx.resultDesc =
      (r.ResponseDescription as string) ??
      (r.ResponseDesc as string) ??
      tx.resultDesc;
    tx.rawResponseJson = r;
    await this.mpesaTxRepo.save(tx);
    return data;
  }

  async stkPush(dto: StkPushRequestDto, userId?: string) {
    const phone = this.normalizeMsisdn(dto.phone);

    let order = null as Order | null;
    if (dto.orderId) {
      order = await this.orderRepo.findOne({ where: { id: dto.orderId } });
      if (!order) throw new BadRequestException('Order not found');
      if (userId && order.customerId && order.customerId !== userId) {
        throw new ForbiddenException('Order does not belong to user');
      }
    }

    const amountRaw = dto.amount ?? (order ? Number(order.grandTotal) : undefined);
    const amount = Number.isFinite(Number(amountRaw)) ? Math.round(Number(amountRaw)) : NaN;
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const shortCode = dto.shortCode ?? this.shortcode;
    const passkey = dto.passkey ?? this.passkey;
    const timestamp = this.formatTimestamp();
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

    const accountReference = this.normalizeAccountReference(
      dto.accountReference ?? order?.orderNumber ?? dto.orderId,
      'Checkout',
    );
    const transactionDesc = this.normalizeTransactionDesc(
      dto.transactionDesc ?? `Order ${order?.orderNumber ?? accountReference}`,
      'Checkout payment',
    );

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: shortCode,
      PhoneNumber: phone,
      CallBackURL: dto.callbackUrl ?? this.buildCallbackUrl('/api/v1/mpesa/stk/callback'),
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    };

    const tx = await this.mpesaTxRepo.save(
      this.mpesaTxRepo.create({
        type: MpesaTransactionType.STK,
        status: MpesaTransactionStatus.PENDING,
        orderId: order?.id ?? dto.orderId,
        amount: String(amount),
        msisdn: phone,
        accountReference,
        partyA: phone,
        partyB: shortCode,
        remarks: transactionDesc,
        rawRequestJson: this.asStringRecord(payload),
        rawResponseJson: {},
        rawCallbackJson: {},
      }),
    );

    const data = await this.darajaPost('/mpesa/stkpush/v1/processrequest', payload);
    const r = this.asStringRecord(data);
    tx.originatorConversationId = (r.MerchantRequestID as string) ?? tx.originatorConversationId;
    tx.transactionId = (r.CheckoutRequestID as string) ?? tx.transactionId;
    tx.resultCode =
      typeof r.ResponseCode === 'string'
        ? parseInt(r.ResponseCode, 10)
        : (r.ResponseCode as any);
    tx.resultDesc =
      (r.ResponseDescription as string) ??
      (r.CustomerMessage as string) ??
      tx.resultDesc;
    tx.rawResponseJson = r;
    await this.mpesaTxRepo.save(tx);
    return data;
  }

  async getStkStatus(orderId: string, userId?: string) {
    const trimmed = String(orderId || '').trim();
    if (!trimmed) throw new BadRequestException('Order id is required');

    const order = await this.orderRepo.findOne({ where: { id: trimmed } });
    if (!order) throw new NotFoundException('Order not found');
    if (userId && order.customerId && order.customerId !== userId) {
      throw new ForbiddenException('Order does not belong to user');
    }

    const tx = await this.mpesaTxRepo.findOne({
      where: { orderId: trimmed, type: MpesaTransactionType.STK },
      order: { createdAt: 'DESC' },
    });

    return {
      orderId: trimmed,
      status: tx?.status ?? MpesaTransactionStatus.PENDING,
      resultCode: tx?.resultCode ?? null,
      resultDesc: tx?.resultDesc ?? null,
      amount: tx?.amount ?? null,
      msisdn: tx?.msisdn ?? null,
      updatedAt: tx?.updatedAt ?? null,
    };
  }

  // ---- Callback persistence helpers ----

  async handleC2BValidation(body: unknown) {
    const b = this.asStringRecord(body);
    const billRef = b.BillRefNumber as string | undefined;
    const orderId = await this.linkOrderByBillRef(billRef);

    await this.mpesaTxRepo.save(
      this.mpesaTxRepo.create({
        type: MpesaTransactionType.C2B,
        status: MpesaTransactionStatus.VALIDATION_RECEIVED,
        orderId,
        billRefNumber: billRef,
        msisdn: b.MSISDN as string,
        amount: b.TransAmount ? String(b.TransAmount) : undefined,
        transactionId: b.TransID as string,
        rawRequestJson: {},
        rawResponseJson: {},
        rawCallbackJson: b,
      }),
    );

    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  async handleC2BConfirmation(body: unknown) {
    const b = this.asStringRecord(body);
    const billRef =
      (b.BillRefNumber as string | undefined) ?? (b.BillRefNumber as any);
    const orderId = await this.linkOrderByBillRef(billRef);

    // Upsert-ish: if a pending tx exists by transactionId, update it; else create new
    const txId = b.TransID as string | undefined;
    const existing = txId
      ? await this.mpesaTxRepo.findOne({ where: { transactionId: txId } })
      : null;

    if (existing) {
      existing.status = MpesaTransactionStatus.CONFIRMATION_RECEIVED;
      existing.orderId = existing.orderId ?? orderId;
      existing.billRefNumber = existing.billRefNumber ?? billRef;
      existing.msisdn = existing.msisdn ?? (b.MSISDN as string);
      existing.amount =
        existing.amount ?? (b.TransAmount ? String(b.TransAmount) : undefined);
      existing.rawCallbackJson = b;
      await this.mpesaTxRepo.save(existing);
    } else {
      await this.mpesaTxRepo.save(
        this.mpesaTxRepo.create({
          type: MpesaTransactionType.C2B,
          status: MpesaTransactionStatus.CONFIRMATION_RECEIVED,
          orderId,
          transactionId: txId,
          billRefNumber: billRef,
          msisdn: b.MSISDN as string,
          amount: b.TransAmount ? String(b.TransAmount) : undefined,
          rawRequestJson: {},
          rawResponseJson: {},
          rawCallbackJson: b,
        }),
      );
    }

    if (orderId) {
      // Mark order as paid/confirmed if it's not already.
      try {
        const order = await this.orderRepo.findOne({ where: { id: orderId } });
        if (order) {
          const patch: Partial<Order> = {};
          if (order.financialStatus !== FinancialStatus.PAID) {
            patch.financialStatus = FinancialStatus.PAID;
          }
          if (order.status !== OrderStatus.CONFIRMED) {
            patch.status = OrderStatus.CONFIRMED;
          }
          if (!order.confirmedAt) {
            patch.confirmedAt = new Date();
          }
          if (Object.keys(patch).length > 0) {
            await this.orderRepo.update({ id: orderId } as any, patch as any);
          }
        }
      } catch (e) {
        // Non-fatal: transaction persistence succeeded; order update can be retried.
        this.logger.warn(
          'Failed to update order status after C2B confirmation',
        );
      }

      const payload: OrderPaymentSucceededEventPayload = {
        orderId,
        msisdn: (b.MSISDN as string | undefined) ?? undefined,
        amount: b.TransAmount ? String(b.TransAmount) : undefined,
        transactionId: (b.TransID as string | undefined) ?? undefined,
      };

      await this.eventBus.emit<OrderPaymentSucceededEventPayload>(
        ORDER_PAYMENT_SUCCEEDED_EVENT,
        payload,
      );
    }

    return { ResultCode: 0, ResultDesc: 'Received' };
  }

  private parseResultEnvelope(body: unknown): {
    conversationId?: string;
    originatorConversationId?: string;
    resultCode?: number;
    resultDesc?: string;
    transactionId?: string;
    raw: Record<string, unknown>;
  } {
    const raw = this.asStringRecord(body);
    const result = this.asStringRecord(raw.Result);

    const conversationId = result.ConversationID as string | undefined;
    const originatorConversationId = result.OriginatorConversationID as
      | string
      | undefined;
    const resultCode =
      typeof result.ResultCode === 'number'
        ? result.ResultCode
        : typeof result.ResultCode === 'string'
          ? parseInt(result.ResultCode, 10)
          : undefined;
    const resultDesc = result.ResultDesc as string | undefined;

    // Transaction ID sometimes appears in ResultParameters
    let transactionId: string | undefined;
    const params = this.asStringRecord(result.ResultParameters);
    const arr = params.ResultParameter as unknown[];
    if (Array.isArray(arr)) {
      for (const p of arr) {
        const pr = this.asStringRecord(p);
        if (pr.Key === 'TransactionID' && typeof pr.Value === 'string') {
          transactionId = pr.Value;
        }
      }
    }

    return {
      conversationId,
      originatorConversationId,
      resultCode,
      resultDesc,
      transactionId,
      raw,
    };
  }

  async handleB2CResult(body: unknown) {
    const parsed = this.parseResultEnvelope(body);
    const existing = await this.findByConversation(
      parsed.conversationId,
      parsed.originatorConversationId,
    );

    if (existing) {
      existing.resultCode = parsed.resultCode;
      existing.resultDesc = parsed.resultDesc;
      existing.transactionId = parsed.transactionId ?? existing.transactionId;
      existing.status =
        parsed.resultCode === 0
          ? MpesaTransactionStatus.SUCCESS
          : MpesaTransactionStatus.FAILED;
      existing.rawCallbackJson = parsed.raw;
      await this.mpesaTxRepo.save(existing);
    } else {
      await this.mpesaTxRepo.save(
        this.mpesaTxRepo.create({
          type: MpesaTransactionType.B2C,
          status:
            parsed.resultCode === 0
              ? MpesaTransactionStatus.SUCCESS
              : MpesaTransactionStatus.FAILED,
          conversationId: parsed.conversationId,
          originatorConversationId: parsed.originatorConversationId,
          transactionId: parsed.transactionId,
          resultCode: parsed.resultCode,
          resultDesc: parsed.resultDesc,
          rawRequestJson: {},
          rawResponseJson: {},
          rawCallbackJson: parsed.raw,
        }),
      );
    }

    return { ResultCode: 0, ResultDesc: 'Received' };
  }

  async handleB2CTimeout(body: unknown) {
    const parsed = this.parseResultEnvelope(body);
    const existing = await this.findByConversation(
      parsed.conversationId,
      parsed.originatorConversationId,
    );
    if (existing) {
      existing.status = MpesaTransactionStatus.TIMEOUT;
      existing.rawCallbackJson = parsed.raw;
      await this.mpesaTxRepo.save(existing);
    } else {
      await this.mpesaTxRepo.save(
        this.mpesaTxRepo.create({
          type: MpesaTransactionType.B2C,
          status: MpesaTransactionStatus.TIMEOUT,
          conversationId: parsed.conversationId,
          originatorConversationId: parsed.originatorConversationId,
          rawRequestJson: {},
          rawResponseJson: {},
          rawCallbackJson: parsed.raw,
        }),
      );
    }
    return { ResultCode: 0, ResultDesc: 'Received' };
  }

  async handleB2BResult(body: unknown) {
    const parsed = this.parseResultEnvelope(body);
    const existing = await this.findByConversation(
      parsed.conversationId,
      parsed.originatorConversationId,
    );

    if (existing) {
      existing.resultCode = parsed.resultCode;
      existing.resultDesc = parsed.resultDesc;
      existing.transactionId = parsed.transactionId ?? existing.transactionId;
      existing.status =
        parsed.resultCode === 0
          ? MpesaTransactionStatus.SUCCESS
          : MpesaTransactionStatus.FAILED;
      existing.rawCallbackJson = parsed.raw;
      await this.mpesaTxRepo.save(existing);
    } else {
      await this.mpesaTxRepo.save(
        this.mpesaTxRepo.create({
          type: MpesaTransactionType.B2B,
          status:
            parsed.resultCode === 0
              ? MpesaTransactionStatus.SUCCESS
              : MpesaTransactionStatus.FAILED,
          conversationId: parsed.conversationId,
          originatorConversationId: parsed.originatorConversationId,
          transactionId: parsed.transactionId,
          resultCode: parsed.resultCode,
          resultDesc: parsed.resultDesc,
          rawRequestJson: {},
          rawResponseJson: {},
          rawCallbackJson: parsed.raw,
        }),
      );
    }

    return { ResultCode: 0, ResultDesc: 'Received' };
  }

  async handleB2BTimeout(body: unknown) {
    const parsed = this.parseResultEnvelope(body);
    const existing = await this.findByConversation(
      parsed.conversationId,
      parsed.originatorConversationId,
    );
    if (existing) {
      existing.status = MpesaTransactionStatus.TIMEOUT;
      existing.rawCallbackJson = parsed.raw;
      await this.mpesaTxRepo.save(existing);
    } else {
      await this.mpesaTxRepo.save(
        this.mpesaTxRepo.create({
          type: MpesaTransactionType.B2B,
          status: MpesaTransactionStatus.TIMEOUT,
          conversationId: parsed.conversationId,
          originatorConversationId: parsed.originatorConversationId,
          rawRequestJson: {},
          rawResponseJson: {},
          rawCallbackJson: parsed.raw,
        }),
      );
    }
    return { ResultCode: 0, ResultDesc: 'Received' };
  }

  async handleStkCallback(body: unknown) {
    const raw = this.asStringRecord(body);
    const stk = this.asStringRecord(this.asStringRecord(raw.Body).stkCallback);
    const resultCode =
      typeof stk.ResultCode === 'number'
        ? stk.ResultCode
        : typeof stk.ResultCode === 'string'
          ? parseInt(stk.ResultCode, 10)
          : undefined;
    const resultDesc = stk.ResultDesc as string | undefined;
    const checkoutRequestId = stk.CheckoutRequestID as string | undefined;
    const merchantRequestId = stk.MerchantRequestID as string | undefined;

    let amount: string | undefined;
    let receiptNumber: string | undefined;
    let phoneNumber: string | undefined;
    const metadata = this.asStringRecord(stk.CallbackMetadata);
    const items = metadata.Item as unknown[];
    if (Array.isArray(items)) {
      for (const item of items) {
        const parsed = this.asStringRecord(item);
        if (parsed.Name === 'Amount') amount = parsed.Value ? String(parsed.Value) : amount;
        if (parsed.Name === 'MpesaReceiptNumber') receiptNumber = parsed.Value ? String(parsed.Value) : receiptNumber;
        if (parsed.Name === 'PhoneNumber') phoneNumber = parsed.Value ? String(parsed.Value) : phoneNumber;
      }
    }

    const existing = await this.findByCheckoutRequestId(checkoutRequestId);
    if (existing) {
      existing.resultCode = resultCode;
      existing.resultDesc = resultDesc;
      existing.status = resultCode === 0 ? MpesaTransactionStatus.SUCCESS : MpesaTransactionStatus.FAILED;
      existing.transactionId = checkoutRequestId ?? existing.transactionId;
      existing.originatorConversationId = merchantRequestId ?? existing.originatorConversationId;
      existing.amount = amount ?? existing.amount;
      existing.msisdn = phoneNumber ?? existing.msisdn;
      existing.rawCallbackJson = raw;
      await this.mpesaTxRepo.save(existing);

      if (existing.orderId && resultCode === 0) {
        try {
          const order = await this.orderRepo.findOne({ where: { id: existing.orderId } });
          if (order) {
            const patch: Partial<Order> = {};
            if (order.financialStatus !== FinancialStatus.PAID) {
              patch.financialStatus = FinancialStatus.PAID;
            }
            if (order.status !== OrderStatus.CONFIRMED) {
              patch.status = OrderStatus.CONFIRMED;
            }
            if (!order.confirmedAt) {
              patch.confirmedAt = new Date();
            }
            if (Object.keys(patch).length > 0) {
              await this.orderRepo.update({ id: order.id } as any, patch as any);
            }
          }
        } catch {
          this.logger.warn('Failed to update order after STK callback');
        }

        const payload: OrderPaymentSucceededEventPayload = {
          orderId: existing.orderId,
          msisdn: phoneNumber ?? existing.msisdn ?? undefined,
          amount: amount ?? existing.amount ?? undefined,
          transactionId: receiptNumber ?? checkoutRequestId ?? undefined,
        };

        await this.eventBus.emit<OrderPaymentSucceededEventPayload>(
          ORDER_PAYMENT_SUCCEEDED_EVENT,
          payload,
        );
      }

      return { ResultCode: 0, ResultDesc: 'Received' };
    }

    await this.mpesaTxRepo.save(
      this.mpesaTxRepo.create({
        type: MpesaTransactionType.STK,
        status: resultCode === 0 ? MpesaTransactionStatus.SUCCESS : MpesaTransactionStatus.FAILED,
        originatorConversationId: merchantRequestId,
        transactionId: checkoutRequestId,
        resultCode,
        resultDesc,
        amount: amount ?? undefined,
        msisdn: phoneNumber ?? undefined,
        rawRequestJson: {},
        rawResponseJson: {},
        rawCallbackJson: raw,
      }),
    );

    return { ResultCode: 0, ResultDesc: 'Received' };
  }
}
