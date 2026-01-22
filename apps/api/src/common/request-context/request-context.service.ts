import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContextChannel = {
  id?: string;
  code?: string;
  name?: string;
};

export type RequestContextStore = {
  requestId?: string;
  channel?: RequestContextChannel;
};

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, fn: () => T): T {
    return this.storage.run(store, fn);
  }

  set(partial: RequestContextStore): void {
    const current = this.storage.getStore();
    if (!current) return;
    Object.assign(current, partial);
  }

  get requestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }

  get channel(): RequestContextChannel | undefined {
    return this.storage.getStore()?.channel;
  }

  get channelId(): string | undefined {
    return this.storage.getStore()?.channel?.id;
  }

  get channelCode(): string | undefined {
    return this.storage.getStore()?.channel?.code;
  }

  get channelName(): string | undefined {
    return this.storage.getStore()?.channel?.name;
  }
}
