import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrderService } from '../order.service';
import { Order } from '../../entities/order.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { PriceList } from '../../../catalog/entities/price-list.entity';
import { PriceService } from '../../../catalog/services/price.service';
import { OrderLevelCharge } from '../../entities/order-level-charge.entity';
import { TaxService } from '../../services/tax.service';
import { ShippingMatrixService } from '../../../shipping/services/shipping-matrix.service';
import { OrderShippingAddress } from '../../entities/order-shipping-address.entity';
import { User } from '../../../user/entities/user.entity';
import { Location } from '../../../location/entities/location.entity';
import { CurrencyService } from '../../../currency/currency.service';
import { CustomerShippingAddressService } from '../../../customer-shipping-address/services/customer-shipping-address.service';
import { ConfigService } from '@nestjs/config';
import { OrderNotificationService } from '../../services/order-notification.service';

describe('OrderService', () => {
  let service: OrderService;

  const orderRepo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };
  const orderItemRepo = { create: jest.fn(), save: jest.fn() };
  const userRepo = { findOne: jest.fn() };
  const priceListRepo = { findOne: jest.fn() };
  const priceService = {
    resolveSkuPrice: jest.fn(),
    findActivePriceListByCurrency: jest.fn(),
  };
  const orderLevelChargeRepo = { create: jest.fn(), save: jest.fn() };
  const orderShippingAddressRepo = { create: jest.fn(), save: jest.fn() };
  const locationRepo = { findOne: jest.fn() };
  const shippingMatrixService = { getQuotes: jest.fn() };
  const taxService = { calculateTax: jest.fn() };
  const currencyService = {
    getDefaultCurrencyCode: jest.fn(),
    assertExists: jest.fn(),
  };
  const customerShippingAddressService = {
    getOptionalForUser: jest.fn(),
    upsertForUser: jest.fn(),
  };
  const configService = { get: jest.fn() };
  const orderNotificationService = { send: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(PriceList), useValue: priceListRepo },
        {
          provide: getRepositoryToken(OrderLevelCharge),
          useValue: orderLevelChargeRepo,
        },
        {
          provide: getRepositoryToken(OrderShippingAddress),
          useValue: orderShippingAddressRepo,
        },
        { provide: getRepositoryToken(Location), useValue: locationRepo },
        { provide: PriceService, useValue: priceService },
        { provide: ShippingMatrixService, useValue: shippingMatrixService },
        { provide: TaxService, useValue: taxService },
        { provide: CurrencyService, useValue: currencyService },
        {
          provide: CustomerShippingAddressService,
          useValue: customerShippingAddressService,
        },
        { provide: ConfigService, useValue: configService },
        {
          provide: OrderNotificationService,
          useValue: orderNotificationService,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  afterEach(() => jest.resetAllMocks());

  it('creates order and items with computed totals', async () => {
    currencyService.getDefaultCurrencyCode.mockResolvedValue('KES');
    currencyService.assertExists.mockResolvedValue('KES');

    const fakeOrder: any = {
      id: '100',
      orderNumber: 'ORD-1',
      itemsSubtotal: '0',
      itemCount: 0,
      currencyCode: 'KES',
    };
    orderRepo.create.mockReturnValue(fakeOrder);
    orderRepo.save.mockImplementation(async (o: any) => o);
    orderRepo.findOne.mockResolvedValue(undefined);

    userRepo.findOne.mockResolvedValue({
      id: 'c1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'Customer',
    } as any);

    customerShippingAddressService.getOptionalForUser.mockResolvedValue(null);
    customerShippingAddressService.upsertForUser.mockResolvedValue({
      address: { locationId: 'loc1', countryCode: 'KE', fieldsJson: {} },
    } as any);

    locationRepo.findOne.mockResolvedValue({
      id: 'loc1',
      countryCode: 'KE',
    } as unknown as Location);

    priceService.resolveSkuPrice.mockResolvedValue({
      priceListId: '1',
      currencyCode: 'KES',
      unitPrice: '100.00',
    });
    priceService.findActivePriceListByCurrency.mockResolvedValue({
      id: '1',
      currency: 'KES',
    } as unknown as PriceList);
    shippingMatrixService.getQuotes.mockResolvedValue([
      {
        method: { id: 'm1', displayName: 'Standard', code: 'standard' } as any,
        rate: {
          id: 'r1',
          calculationType: 'flat',
          price: '50.00',
          metaJson: {},
        } as any,
        amount: 50,
      },
    ]);
    orderShippingAddressRepo.create.mockImplementation((x: any) => x);
    orderShippingAddressRepo.save.mockResolvedValue(undefined);

    orderLevelChargeRepo.create.mockImplementation((x: any) => x);
    orderLevelChargeRepo.save.mockResolvedValue(undefined);

    orderItemRepo.create.mockImplementation((x: any) => x);
    orderItemRepo.save.mockImplementation(async (x: any) => x);
    const payload = {
      customerId: 'c1',
      orderItems: [{ productSkuId: 'pv1', quantity: 2 }],
      shippingLocationId: 'loc1',
    };

    const result = await service.create(payload as any);
    expect(orderRepo.save).toHaveBeenCalled();
    expect(orderItemRepo.save).toHaveBeenCalled();

    // ensure a save was eventually triggered
    const createdItem = orderItemRepo.create.mock.calls[0][0];
    expect(createdItem).toBeDefined();
    expect(createdItem.productSkuId).toBe('pv1');
    expect(createdItem.quantity).toBe(2);
    expect(orderItemRepo.save).toHaveBeenCalled();

    // order-level charges: shipping only
    expect(orderLevelChargeRepo.save).toHaveBeenCalledTimes(1);
    expect(result.grandTotal).toBe('250.0000');
    expect(result.discountTotal).toBe('0');
    expect(result.taxTotal).toBe('0');
    expect(result.shippingTax).toBe('0');
    expect(result.itemCount).toBe(2);
  });
});
