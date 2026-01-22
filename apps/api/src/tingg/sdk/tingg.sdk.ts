import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiClientService } from 'src/common/api-client/api-client.service';

@Injectable()
export class TinggSdk {
  constructor(
    private readonly http: ApiClientService,
    private readonly config: ConfigService,
  ) {}

  private get env(): 'sandbox' | 'production' {
    const value = (this.config.get<string>('TINGG_ENV') || 'sandbox').toLowerCase();
    return value === 'production' ? 'production' : 'sandbox';
  }

  private get apiKey(): string {
    const value = this.config.get<string>('TINGG_API_KEY');
    if (!value) throw new BadRequestException('Missing TINGG_API_KEY');
    return value;
  }

  private get clientId(): string {
    const value = this.config.get<string>('TINGG_CLIENT_ID');
    if (!value) throw new BadRequestException('Missing TINGG_CLIENT_ID');
    return value;
  }

  private get clientSecret(): string {
    const value = this.config.get<string>('TINGG_CLIENT_SECRET');
    if (!value) throw new BadRequestException('Missing TINGG_CLIENT_SECRET');
    return value;
  }

  private get baseUrl(): string {
    return this.env === 'production'
      ? 'https://api.tingg.africa'
      : 'https://api-approval.tingg.africa';
  }

  async getAccessToken(): Promise<string> {
    const url = `${this.baseUrl}/v1/oauth/token/request`;
    const resp = await this.http.request<any>({
      operation: 'tingg.oauth',
      method: 'POST',
      url,
      data: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      },
      headers: {
        apiKey: this.apiKey,
        'Content-Type': 'application/json',
      },
      retry: { attempts: 1 },
    });

    const token = resp.data?.access_token;
    if (!token) throw new BadRequestException('Tingg access_token missing');
    return token;
  }

  async createExpressCheckout(input: {
    token: string;
    payload: Record<string, unknown>;
  }) {
    const url = `${this.baseUrl}/v3/checkout-api/checkout-request/express-request`;

    const resp = await this.http.request<any>({
      operation: 'tingg.express',
      method: 'POST',
      url,
      data: input.payload,
      headers: {
        Authorization: `Bearer ${input.token}`,
        apiKey: this.apiKey,
        'Content-Type': 'application/json',
      },
      retry: { attempts: 1 },
    });

    return resp.data;
  }
}
