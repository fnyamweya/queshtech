import { of, lastValueFrom } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { ResponseInterceptor } from './response.interceptor';

const makeChannel = () => ({
  id: randomUUID(),
  code: randomUUID().slice(0, 8).toUpperCase(),
  name: `Channel-${randomUUID().slice(0, 6)}`,
});

const makeExecutionContext = (req: any, res?: any) =>
  ({
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res ?? { statusCode: 200 },
    }),
  }) as any;

describe('ResponseInterceptor', () => {
  it('includes channel metadata when present', async () => {
    const channel = makeChannel();
    const req = { method: 'GET', channel } as any;
    const res = { statusCode: 200 } as any;

    const interceptor = new ResponseInterceptor();
    const context = makeExecutionContext(req, res);
    const next = { handle: () => of({ ok: true }) } as any;

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toMatchObject({
      success: true,
      data: { ok: true },
      meta: { channel },
    });
  });

  it('leaves pre-formatted responses untouched', async () => {
    const channel = makeChannel();
    const req = { method: 'GET', channel } as any;
    const res = { statusCode: 200 } as any;

    const interceptor = new ResponseInterceptor();
    const context = makeExecutionContext(req, res);
    const formatted = {
      success: true,
      statusCode: 200,
      message: `m-${randomUUID().slice(0, 8)}`,
      data: { ok: true },
    };
    const next = { handle: () => of(formatted) } as any;

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toBe(formatted);
  });
});
