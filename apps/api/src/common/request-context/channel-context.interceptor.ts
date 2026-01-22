import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Repository } from 'typeorm';
import { Channel } from 'src/channels/entities/channel.entity';
import { AppCacheService } from '../cache/app-cache.service';
import { RequestContextService } from './request-context.service';

const CHANNEL_HEADER = 'x-channel';
const CHANNEL_HEADER_ALT = 'x-sales-channel';
const DEFAULT_CHANNEL_ENV = 'DEFAULT_CHANNEL_CODE';
const WEB_CHANNEL_ENV = 'WEB_CHANNEL_CODE';

@Injectable()
export class ChannelContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ChannelContextInterceptor.name);

  constructor(
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    private readonly configService: ConfigService,
    private readonly cache: AppCacheService,
    private readonly requestContext: RequestContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return from(this.attachChannelContext(context)).pipe(
      switchMap(() => next.handle()),
    );
  }

  private getHeaderValue(req: Request): string | undefined {
    const headers = (req?.headers || {}) as Record<string, unknown>;
    const raw =
      headers[CHANNEL_HEADER] ??
      headers[CHANNEL_HEADER.toUpperCase()] ??
      headers[CHANNEL_HEADER_ALT] ??
      headers[CHANNEL_HEADER_ALT.toUpperCase()];

    if (Array.isArray(raw)) return String(raw[0] ?? '').trim();
    if (typeof raw === 'string') return raw.trim();
    return undefined;
  }

  private getQueryValue(req: Request): string | undefined {
    const query = (req?.query || {}) as Record<string, unknown>;
    const raw = query.channel ?? query.channelCode;
    if (Array.isArray(raw)) return String(raw[0] ?? '').trim();
    if (typeof raw === 'string') return raw.trim();
    return undefined;
  }

  private getDefaultChannelCode(): string {
    const configured =
      this.configService.get<string>(WEB_CHANNEL_ENV) ||
      this.configService.get<string>(DEFAULT_CHANNEL_ENV);
    return (configured || 'WEB').trim().toUpperCase();
  }

  private normalizeCode(code: string | undefined): string | undefined {
    const normalized = (code || '').trim().toUpperCase();
    return normalized ? normalized : undefined;
  }

  private async resolveChannelByCode(code: string | undefined) {
    const normalized = this.normalizeCode(code);
    if (!normalized) return null;

    const cacheKey = `channels:code:${normalized}`;
    return this.cache.remember(
      cacheKey,
      async () => {
        const channel = await this.channelRepo.findOne({
          where: { code: normalized, isActive: true },
        });
        if (!channel) return null;
        return { id: channel.id, code: channel.code, name: channel.name };
      },
      { ttlSeconds: 300 },
    );
  }

  private async attachChannelContext(context: ExecutionContext): Promise<void> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    if (!req) return;

    const headerCode = this.getHeaderValue(req);
    const queryCode = this.getQueryValue(req);
    const fallbackCode = this.getDefaultChannelCode();

    const providedCode = this.normalizeCode(headerCode || queryCode);
    const code = providedCode ?? this.normalizeCode(fallbackCode);
    const channel = await this.resolveChannelByCode(code);

    if (!channel) {
      if (providedCode) {
        this.logger.warn(`Channel not found or inactive for code "${code}"`);
      }
      return;
    }

    (req as any).channel = channel;
    this.requestContext.set({ channel });
  }
}
