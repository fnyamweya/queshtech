import { ShippingMatrixService } from '../shipping-matrix.service';

function mockRepo(overrides: Partial<any> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as any;
}

/**
 * Helper to construct a zoneMethodRepo mock that returns the given methods
 * as if they were eagerly loaded via the `method` relation.
 */
function mockZoneMethodRepoWith(methods: any[]) {
  return mockRepo({
    find: jest.fn().mockResolvedValue(
      methods.map((m) => ({ zoneId: m.zoneId ?? 'g1', isActive: true, method: m })),
    ),
  });
}

describe('ShippingMatrixService', () => {
  let svc: ShippingMatrixService;
  let zoneRepo: any;
  let locRepo: any;
  let methodRepo: any;
  let zoneMethodRepo: any;
  let rateRepo: any;
  let channelRepo: any;
  let cache: any;

  beforeEach(() => {
    // Default: global zone exists so all tests without locationId get zone 'g1'
    zoneRepo = mockRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'g1', code: 'global' }),
    });
    locRepo = mockRepo();
    methodRepo = mockRepo();
    // Default empty - each test overrides
    zoneMethodRepo = mockRepo();
    rateRepo = mockRepo();
    channelRepo = mockRepo();

    cache = {
      remember: jest.fn((_: string, fn: any) => fn()),
      del: jest.fn().mockResolvedValue(undefined),
      delByPrefix: jest.fn().mockResolvedValue(undefined),
    };

    svc = new ShippingMatrixService(
      zoneRepo,
      locRepo,
      methodRepo,
      zoneMethodRepo,
      rateRepo,
      channelRepo,
      cache,
    );
  });

  it('calculates flat rate', async () => {
    // The service resolves global zone 'g1' (mocked above),
    // then finds zone-methods via zoneMethodRepo.find({ where: { zoneId: In(['g1']), isActive: true }, relations: ['method'] })
    zoneMethodRepo.find.mockResolvedValue([
      { zoneId: 'g1', isActive: true, method: { id: 'm1', code: 'standard', isActive: true } },
    ]);

    rateRepo.find.mockResolvedValue([
      {
        id: 'r1',
        methodId: 'm1',
        calculationType: 'flat',
        price: '50.00',
        priority: 1,
        metaJson: {},
      },
    ]);

    const quotes = await svc.getQuotes({ subtotal: 100 });
    expect(quotes.length).toBe(1);
    expect(quotes[0].amount).toBe(50);
  });

  it('calculates per_weight rate', async () => {
    zoneMethodRepo.find.mockResolvedValue([
      { zoneId: 'g1', isActive: true, method: { id: 'm1', code: 'weight', isActive: true } },
    ]);
    rateRepo.find.mockResolvedValue([
      {
        id: 'r1',
        methodId: 'm1',
        calculationType: 'per_weight',
        price: '0',
        pricePerUnit: '10',
        priority: 1,
        metaJson: {},
      },
    ]);

    const quotes = await svc.getQuotes({ subtotal: 0, totalWeight: 3 });
    expect(quotes[0].amount).toBe(30);
  });

  it('calculates per_item rate', async () => {
    zoneMethodRepo.find.mockResolvedValue([
      { zoneId: 'g1', isActive: true, method: { id: 'm1', code: 'per-item', isActive: true } },
    ]);
    rateRepo.find.mockResolvedValue([
      {
        id: 'r1',
        methodId: 'm1',
        calculationType: 'per_item',
        price: '0',
        pricePerUnit: '2.5',
        priority: 1,
        metaJson: {},
      },
    ]);

    const quotes = await svc.getQuotes({ subtotal: 0, itemCount: 4 });
    expect(quotes[0].amount).toBe(10);
  });

  it('calculates table_rate by subtotal', async () => {
    zoneMethodRepo.find.mockResolvedValue([
      { zoneId: 'g1', isActive: true, method: { id: 'm1', code: 'table', isActive: true } },
    ]);
    rateRepo.find.mockResolvedValue([
      {
        id: 'r1',
        methodId: 'm1',
        calculationType: 'table_rate',
        price: '0',
        priority: 1,
        metaJson: {
          measure: 'subtotal',
          tiers: [
            { upto: 100, price: '10' },
            { upto: 1000, price: '20' },
          ],
        },
      },
    ]);

    const quotes = await svc.getQuotes({ subtotal: 50 });
    expect(quotes[0].amount).toBe(10);

    const quotes2 = await svc.getQuotes({ subtotal: 500 });
    expect(quotes2[0].amount).toBe(20);
  });

  it('calculates formula rate', async () => {
    zoneMethodRepo.find.mockResolvedValue([
      { zoneId: 'g1', isActive: true, method: { id: 'm1', code: 'formula', isActive: true } },
    ]);
    rateRepo.find.mockResolvedValue([
      {
        id: 'r1',
        methodId: 'm1',
        calculationType: 'formula',
        price: '0',
        priority: 1,
        metaJson: { formula: 'subtotal * 0.05 + max(0, totalWeight - 5) * 2' },
      },
    ]);

    const quotes = await svc.getQuotes({ subtotal: 200, totalWeight: 8 });
    expect(quotes[0].amount).toBeCloseTo(200 * 0.05 + Math.max(0, 8 - 5) * 2);
  });

  it('handles zero weight for per_weight rates (regression test)', async () => {
    zoneMethodRepo.find.mockResolvedValue([
      { zoneId: 'g1', isActive: true, method: { id: 'm1', code: 'weight', isActive: true } },
    ]);
    rateRepo.find.mockResolvedValue([
      {
        id: 'r1',
        methodId: 'm1',
        calculationType: 'per_weight',
        price: '0',
        pricePerUnit: '10',
        priority: 1,
        metaJson: {},
      },
    ]);

    // totalWeight === 0 should be treated as a valid numeric value, not skipped
    const quotes = await svc.getQuotes({ subtotal: 0, totalWeight: 0 });
    expect(quotes.length).toBeGreaterThan(0);
    expect(quotes[0].amount).toBe(0);
  });
});
