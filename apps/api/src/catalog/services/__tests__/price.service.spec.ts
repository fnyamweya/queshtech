import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PriceService } from '../price.service';
import { PriceList } from '../../entities/price-list.entity';
import { Currency } from '../../entities/currency.entity';
import { ProductSkuPricing } from '../../entities/product-sku-pricing.entity';
import { AppCacheService } from 'src/common/cache/app-cache.service';

describe('PriceService', () => {
  let service: PriceService;

  const priceListRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const currencyRepo = {
    findOne: jest.fn(),
    exist: jest.fn(),
  };
  const skuPricingRepo = {
    find: jest.fn(),
  };
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
  };
  let cacheStore: Map<string, unknown>;

  beforeEach(async () => {
    cacheStore = new Map<string, unknown>();
    cache.get.mockImplementation(async (key: string) => cacheStore.get(key));
    cache.set.mockImplementation(async (key: string, value: unknown) => {
      cacheStore.set(key, value);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceService,
        { provide: getRepositoryToken(PriceList), useValue: priceListRepo },
        { provide: getRepositoryToken(Currency), useValue: currencyRepo },
        {
          provide: getRepositoryToken(ProductSkuPricing),
          useValue: skuPricingRepo,
        },
        { provide: AppCacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<PriceService>(PriceService);
  });

  afterEach(() => {
    jest.resetAllMocks();
    cacheStore.clear();
  });

  it('resolves price for SKU using provided price list', async () => {
    const pl = {
      id: '1',
      currency: 'KES',
      status: 'active',
      priority: 0,
    } as PriceList;
    priceListRepo.findOne.mockResolvedValue(pl);
    currencyRepo.exist.mockResolvedValue(true);
    currencyRepo.findOne.mockResolvedValueOnce({
      code: 'KES',
      precision: 2,
    } as Currency);
    skuPricingRepo.find.mockResolvedValueOnce([
      {
        id: 'r1',
        unitAmount: '100000',
        compareAtAmount: '120000',
        minQuantity: 1,
        selectorJson: {},
      } as unknown as ProductSkuPricing,
    ]);

    const resolved = await service.resolveSkuPrice({
      productSkuId: 'pv1',
      priceListId: '1',
      quantity: 1,
    });
    expect(resolved.unitPrice).toBe('1000.00');
    expect(resolved.currencyCode).toBe('KES');
    expect(priceListRepo.findOne).toHaveBeenCalled();
  });

  it('selects price list by currency precedence (priority)', async () => {
    const high = {
      id: '2',
      code: 'high',
      currency: 'KES',
      status: 'active',
      priority: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as PriceList;
    priceListRepo.findOne.mockResolvedValueOnce(high);
    currencyRepo.exist.mockResolvedValue(true);
    currencyRepo.findOne.mockResolvedValueOnce({
      code: 'KES',
      precision: 2,
    } as Currency);
    skuPricingRepo.find.mockResolvedValueOnce([
      {
        id: 'r2',
        unitAmount: '20000',
        compareAtAmount: '25000',
        minQuantity: 1,
        selectorJson: {},
      } as unknown as ProductSkuPricing,
    ]);

    const resolved = await service.resolveSkuPrice({
      productSkuId: 'pv1',
      currencyCode: 'KES',
      quantity: 1,
    });
    expect(resolved.unitPrice).toBe('200.00');
    expect(resolved.priceListId).toBe('2');
  });

  it('caches resolved price', async () => {
    const pl = {
      id: '3',
      code: 'pl3',
      currency: 'KES',
      status: 'active',
      priority: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as PriceList;
    priceListRepo.findOne.mockResolvedValueOnce(pl);
    currencyRepo.exist.mockResolvedValue(true);
    currencyRepo.findOne.mockResolvedValueOnce({
      code: 'KES',
      precision: 2,
    } as Currency);
    skuPricingRepo.find.mockResolvedValueOnce([
      {
        id: 'r3',
        unitAmount: '10000',
        minQuantity: 1,
        selectorJson: {},
      } as unknown as ProductSkuPricing,
    ]);

    const r1 = await service.resolveSkuPrice({
      productSkuId: 'pv-cache',
      currencyCode: 'KES',
      quantity: 1,
    });
    const r2 = await service.resolveSkuPrice({
      productSkuId: 'pv-cache',
      currencyCode: 'KES',
      quantity: 1,
    });

    expect(r1.unitPrice).toBe('100.00');
    expect(r2.unitPrice).toBe('100.00');
    expect(skuPricingRepo.find).toHaveBeenCalledTimes(1);
  });

  it('prefers context-matched prices over generic ones', async () => {
    const pl = {
      id: 'ctx',
      currency: 'KES',
      status: 'active',
      priority: 0,
    } as PriceList;
    priceListRepo.findOne.mockResolvedValue(pl);
    currencyRepo.exist.mockResolvedValue(true);
    currencyRepo.findOne.mockResolvedValueOnce({
      code: 'KES',
      precision: 2,
    } as Currency);
    skuPricingRepo.find.mockResolvedValueOnce([
      {
        id: 'r4',
        unitAmount: '9000',
        minQuantity: 1,
        selectorJson: { customerGroupIds: ['vip'] },
      } as unknown as ProductSkuPricing,
      {
        id: 'r5',
        unitAmount: '10000',
        minQuantity: 1,
        selectorJson: {},
      } as unknown as ProductSkuPricing,
    ]);

    const resolved = await service.resolveSkuPrice({
      productSkuId: 'pv1',
      priceListId: 'ctx',
      quantity: 1,
      context: { customerGroupId: 'vip' },
    });

    expect(resolved.unitPrice).toBe('90.00');
  });
});
