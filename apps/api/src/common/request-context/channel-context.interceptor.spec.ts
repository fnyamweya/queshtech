import { of, lastValueFrom } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { ChannelContextInterceptor } from './channel-context.interceptor';
import { RequestContextService } from './request-context.service';

const makeCode = () => randomUUID().slice(0, 8);
const makeChannel = (code: string) => ({
  id: randomUUID(),
  code,
  name: `Channel-${randomUUID().slice(0, 6)}`,
});

const makeExecutionContext = (req: any, res?: any) =>
  ({
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res ?? { statusCode: 200 },
    }),
  }) as any;

describe('ChannelContextInterceptor', () => {
  it('resolves channel from header and attaches to request/context', async () => {
    const rawCode = makeCode().toLowerCase();
    const normalizedCode = rawCode.toUpperCase();
    const channel = makeChannel(normalizedCode);

    const channelRepo = {
      findOne: jest.fn().mockResolvedValue(channel),
    } as any;

    const cache = {
      remember: jest.fn(async (_key: string, factory: () => Promise<any>) => factory()),
    } as any;

    const configService = {
      get: jest.fn().mockReturnValue(null),
    } as any;

    const requestContext = new RequestContextService();
    const interceptor = new ChannelContextInterceptor(
      channelRepo,
      configService,
      cache,
      requestContext,
    );

    const req = { headers: { 'x-channel': rawCode }, query: {} } as any;
    const context = makeExecutionContext(req);
    const next = { handle: () => of('ok') } as any;

    await requestContext.run({ requestId: randomUUID() }, async () => {
      await lastValueFrom(interceptor.intercept(context, next));

      expect(req.channel).toEqual({
        id: channel.id,
        code: channel.code,
        name: channel.name,
      });
      expect(requestContext.channelCode).toBe(channel.code);
    });

    expect(channelRepo.findOne).toHaveBeenCalledWith({
      where: { code: normalizedCode, isActive: true },
    });
    expect(cache.remember).toHaveBeenCalledTimes(1);
  });

  it('falls back to default channel code from configuration', async () => {
    const envCode = makeCode().toUpperCase();
    const channel = makeChannel(envCode);

    const channelRepo = {
      findOne: jest.fn().mockResolvedValue(channel),
    } as any;

    const cache = {
      remember: jest.fn(async (_key: string, factory: () => Promise<any>) => factory()),
    } as any;

    const configService = {
      get: jest.fn((key: string) => (key.includes('CHANNEL') ? envCode : null)),
    } as any;

    const requestContext = new RequestContextService();
    const interceptor = new ChannelContextInterceptor(
      channelRepo,
      configService,
      cache,
      requestContext,
    );

    const req = { headers: {}, query: {} } as any;
    const context = makeExecutionContext(req);
    const next = { handle: () => of('ok') } as any;

    await requestContext.run({ requestId: randomUUID() }, async () => {
      await lastValueFrom(interceptor.intercept(context, next));
      expect(requestContext.channelCode).toBe(envCode);
    });
  });

  it('uses query channel when header is absent', async () => {
    const queryCode = makeCode().toUpperCase();
    const channel = makeChannel(queryCode);

    const channelRepo = {
      findOne: jest.fn().mockResolvedValue(channel),
    } as any;

    const cache = {
      remember: jest.fn(async (_key: string, factory: () => Promise<any>) => factory()),
    } as any;

    const configService = {
      get: jest.fn().mockReturnValue(null),
    } as any;

    const requestContext = new RequestContextService();
    const interceptor = new ChannelContextInterceptor(
      channelRepo,
      configService,
      cache,
      requestContext,
    );

    const req = { headers: {}, query: { channel: queryCode.toLowerCase() } } as any;
    const context = makeExecutionContext(req);
    const next = { handle: () => of('ok') } as any;

    await requestContext.run({ requestId: randomUUID() }, async () => {
      await lastValueFrom(interceptor.intercept(context, next));
      expect(requestContext.channelCode).toBe(queryCode);
    });
  });

  it('does not attach channel when lookup fails', async () => {
    const cache = {
      remember: jest.fn(async (_key: string, factory: () => Promise<any>) => factory()),
    } as any;

    const channelRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    } as any;

    const configService = {
      get: jest.fn().mockReturnValue(makeCode().toUpperCase()),
    } as any;

    const requestContext = new RequestContextService();
    const interceptor = new ChannelContextInterceptor(
      channelRepo,
      configService,
      cache,
      requestContext,
    );

    const req = { headers: {}, query: {} } as any;
    const context = makeExecutionContext(req);
    const next = { handle: () => of('ok') } as any;

    await requestContext.run({ requestId: randomUUID() }, async () => {
      await lastValueFrom(interceptor.intercept(context, next));
      expect(requestContext.channel).toBeUndefined();
      expect((req as any).channel).toBeUndefined();
    });
  });
});
