import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiClientService } from 'src/common/api-client/api-client.service';

@Injectable()
export class PaystackSdk {
  constructor(
    private readonly http: ApiClientService,
    private readonly config: ConfigService,
  ) {}

  private get secretKey(): string {
    const value = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!value) throw new BadRequestException('Missing PAYSTACK_SECRET_KEY');
    return value;
  }

  private get callbackUrl(): string | undefined {
    const value = this.config.get<string>('PAYSTACK_CALLBACK_URL');
    return value?.trim() || undefined;
  }

  async initializeTransaction(input: {
    email: string;
    amount: number;
    currency: string;
    reference: string;
    metadata?: Record<string, unknown>;
  }) {
    const url = 'https://api.paystack.co/transaction/initialize';
    const payload = {
      email: input.email,
      amount: Math.round(input.amount * 100),
      currency: input.currency,
      reference: input.reference,
      callback_url: this.callbackUrl,
      metadata: input.metadata ?? {},
    };

    const resp = await this.http.request<any>({
      operation: 'paystack.initialize',
      method: 'POST',
      url,
      data: payload,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      retry: { attempts: 1 },
    });

    return resp.data;
  }

  async verifyTransaction(reference: string) {
    const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
    const resp = await this.http.request<any>({
      operation: 'paystack.verify',
      method: 'GET',
      url,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      retry: { attempts: 1 },
    });

    return resp.data;
  }
}
