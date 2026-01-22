import { RequestContextService } from './request-context.service';
import { randomUUID } from 'node:crypto';

describe('RequestContextService', () => {
  const makeChannel = () => ({
    id: randomUUID(),
    code: randomUUID().slice(0, 8).toUpperCase(),
    name: `Channel-${randomUUID().slice(0, 6)}`,
  });

  it('stores and exposes channel context', async () => {
    const service = new RequestContextService();
    const channel = makeChannel();

    await service.run({ requestId: randomUUID() }, async () => {
      service.set({ channel });

      expect(service.channelId).toBe(channel.id);
      expect(service.channelCode).toBe(channel.code);
      expect(service.channelName).toBe(channel.name);
      expect(service.channel).toEqual(channel);
    });
  });
});
