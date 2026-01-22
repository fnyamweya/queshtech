import { ShippingAdminService } from '../shipping-admin.service';
import { BadRequestException } from '@nestjs/common';

function mockRepo(overrides: Partial<any> = {}) {
  return {
    create: jest.fn((v: any) => v),
    save: jest.fn((v: any) => Promise.resolve({ ...v, id: 'r1' })),
    update: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  } as any;
}

describe('ShippingAdminService', () => {
  let svc: ShippingAdminService;
  let zoneRepo: any;
  let zoneLocationRepo: any;
  let methodRepo: any;
  let zoneMethodRepo: any;
  let providerRepo: any;
  let rateRepo: any;
  let channelRepo: any;
  let locationRepo: any;
  let cache: any;
  let currencyService: any;

  beforeEach(() => {
    zoneRepo = mockRepo();
    zoneLocationRepo = mockRepo({
      // createZoneLocation() expects zoneRepo.findOne() to validate zone exists
      // so this repo doesn't need special behavior for these formula tests
    });
    methodRepo = mockRepo();
    zoneMethodRepo = mockRepo();
    providerRepo = mockRepo();
    rateRepo = mockRepo();
    channelRepo = mockRepo();
    locationRepo = mockRepo();

    cache = {
      delByPrefix: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      remember: jest.fn((_: string, fn: any) => fn()),
    };

    currencyService = {
      convert: jest.fn().mockResolvedValue(100),
    };

    svc = new ShippingAdminService(
      zoneRepo,
      zoneLocationRepo,
      methodRepo,
      zoneMethodRepo,
      providerRepo,
      rateRepo,
      channelRepo,
      locationRepo,
      cache,
      currencyService,
    );
  });

  it('rejects invalid formula on createRate', async () => {
    await expect(
      svc.createRate({
        methodId: 'm1',
        calculationType: 'formula',
        price: '0',
        metaJson: { formula: 'process.exit()' },
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts valid formula on createRate', async () => {
    await expect(
      svc.createRate({
        methodId: 'm1',
        calculationType: 'formula',
        price: '0',
        metaJson: { formula: 'subtotal * 0.05' },
      } as any),
    ).resolves.toBeDefined();
  });
});
