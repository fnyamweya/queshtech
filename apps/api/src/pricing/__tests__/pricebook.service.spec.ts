import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PricebookService } from '../pricebook.service';
import { Pricebook } from '../entities/pricebook.entity';
import { PricebookRevision } from '../entities/pricebook-revision.entity';
import { Channel } from '../../channels/entities/channel.entity';
import { CustomerGroup } from '../../customer-group/entities/customer-group.entity';
import { SalesChannel } from '../../catalog/entities/sales-channel.entity';
import { PriceList } from '../../catalog/entities/price-list.entity';
import { CurrencyService } from '../../currency/currency.service';
import { EventBusService } from '../../queue/event-bus.service';

describe('PricebookService', () => {
  let service: PricebookService;

  const mockPricebookRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockRevisionRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockChannelRepo = { findBy: jest.fn() };
  const mockCustomerGroupRepo = { findBy: jest.fn() };
  const mockSalesChannelRepo = { findBy: jest.fn() };
  const mockPriceListRepo = { findBy: jest.fn() };
  const mockCurrencyService = { assertExists: jest.fn() };
  const mockEventBus = { emit: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricebookService,
        { provide: getRepositoryToken(Pricebook), useValue: mockPricebookRepo },
        { provide: getRepositoryToken(PricebookRevision), useValue: mockRevisionRepo },
        { provide: getRepositoryToken(Channel), useValue: mockChannelRepo },
        { provide: getRepositoryToken(CustomerGroup), useValue: mockCustomerGroupRepo },
        { provide: getRepositoryToken(SalesChannel), useValue: mockSalesChannelRepo },
        { provide: getRepositoryToken(PriceList), useValue: mockPriceListRepo },
        { provide: CurrencyService, useValue: mockCurrencyService },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<PricebookService>(PricebookService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createPricebook', () => {
    it('throws PRICEBOOK_CODE_EXISTS when code already exists', async () => {
      mockPricebookRepo.findOne.mockResolvedValue({ id: 'existing', code: 'DEFAULT' });

      await expect(
        service.createPricebook({ code: 'DEFAULT', name: 'Default' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a new pricebook successfully', async () => {
      mockPricebookRepo.findOne.mockResolvedValue(null);
      mockChannelRepo.findBy.mockResolvedValue([]);
      mockCustomerGroupRepo.findBy.mockResolvedValue([]);
      mockSalesChannelRepo.findBy.mockResolvedValue([]);
      mockPricebookRepo.create.mockReturnValue({ id: 'new', code: 'DEFAULT', name: 'Default' });
      mockPricebookRepo.save.mockResolvedValue({ id: 'new', code: 'DEFAULT', name: 'Default' });
      mockEventBus.emit.mockResolvedValue(undefined);

      const result = await service.createPricebook({ code: 'DEFAULT', name: 'Default' });

      expect(result.code).toBe('DEFAULT');
      expect(mockEventBus.emit).toHaveBeenCalledWith('pricebook.created', expect.any(Object));
    });
  });

  describe('createRevision', () => {
    it('throws PRICEBOOK_NOT_FOUND when pricebook does not exist', async () => {
      mockPricebookRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createRevision('nonexistent', {
          currency: 'KES',
          configSnapshot: { version: '1.0', currency: 'KES' },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('validates currency consistency', async () => {
      mockPricebookRepo.findOne.mockResolvedValue({ id: 'pb1', code: 'DEFAULT' });
      mockCurrencyService.assertExists.mockResolvedValue('KES');

      await expect(
        service.createRevision('pb1', {
          currency: 'KES',
          configSnapshot: { version: '1.0', currency: 'USD' },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a new revision with incremented revision number', async () => {
      mockPricebookRepo.findOne.mockResolvedValue({ id: 'pb1', code: 'DEFAULT' });
      mockCurrencyService.assertExists.mockResolvedValue('KES');
      mockRevisionRepo.findOne.mockResolvedValue({ revisionNumber: 3 });
      mockPriceListRepo.findBy.mockResolvedValue([]);
      mockRevisionRepo.create.mockReturnValue({
        id: 'rev4',
        pricebookId: 'pb1',
        revisionNumber: 4,
        status: 'DRAFT',
      });
      mockRevisionRepo.save.mockResolvedValue({
        id: 'rev4',
        pricebookId: 'pb1',
        revisionNumber: 4,
        status: 'DRAFT',
      });
      mockEventBus.emit.mockResolvedValue(undefined);

      const result = await service.createRevision('pb1', {
        currency: 'KES',
        configSnapshot: { version: '1.0', currency: 'KES' },
      });

      expect(result.revisionNumber).toBe(4);
    });
  });

  describe('validateRevision', () => {
    it('detects missing version', async () => {
      mockRevisionRepo.findOne.mockResolvedValue({
        id: 'rev1',
        pricebookId: 'pb1',
        currencyCode: 'KES',
        configSnapshot: { currency: 'KES' },
      });

      const result = await service.validateRevision('pb1', 'rev1');

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: 'MISSING_FIELD', path: 'version' }),
      );
    });

    it('detects currency mismatch', async () => {
      mockRevisionRepo.findOne.mockResolvedValue({
        id: 'rev1',
        pricebookId: 'pb1',
        currencyCode: 'KES',
        configSnapshot: { version: '1.0', currency: 'USD' },
      });

      const result = await service.validateRevision('pb1', 'rev1');

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: 'CURRENCY_MISMATCH' }),
      );
    });

    it('detects invalid tax mode', async () => {
      mockRevisionRepo.findOne.mockResolvedValue({
        id: 'rev1',
        pricebookId: 'pb1',
        currencyCode: 'KES',
        configSnapshot: {
          version: '1.0',
          currency: 'KES',
          tax: { mode: 'INVALID', vatRate: 0.16 },
        },
      });

      const result = await service.validateRevision('pb1', 'rev1');

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: 'INVALID_VALUE', path: 'tax.mode' }),
      );
    });

    it('detects out-of-range VAT rate', async () => {
      mockRevisionRepo.findOne.mockResolvedValue({
        id: 'rev1',
        pricebookId: 'pb1',
        currencyCode: 'KES',
        configSnapshot: {
          version: '1.0',
          currency: 'KES',
          tax: { mode: 'EXCLUSIVE', vatRate: 1.5 },
        },
      });

      const result = await service.validateRevision('pb1', 'rev1');

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: 'INVALID_VALUE', path: 'tax.vatRate' }),
      );
    });

    it('detects missing allocation rules', async () => {
      mockRevisionRepo.findOne.mockResolvedValue({
        id: 'rev1',
        pricebookId: 'pb1',
        currencyCode: 'KES',
        configSnapshot: {
          version: '1.0',
          currency: 'KES',
          allocation: { rules: {} },
        },
      });

      const result = await service.validateRevision('pb1', 'rev1');

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ path: 'allocation.rules.DISCOUNT' }),
      );
      expect(result.issues).toContainEqual(
        expect.objectContaining({ path: 'allocation.rules.SHIPPING' }),
      );
    });

    it('passes validation for valid config', async () => {
      mockRevisionRepo.findOne.mockResolvedValue({
        id: 'rev1',
        pricebookId: 'pb1',
        currencyCode: 'KES',
        configSnapshot: {
          version: '1.0',
          currency: 'KES',
          tax: { mode: 'EXCLUSIVE', vatRate: 0.16 },
          allocation: {
            rules: {
              DISCOUNT: { basis: 'PROPORTIONAL_VALUE' },
              SHIPPING: { basis: 'WEIGHT' },
            },
            residual: { strategy: 'ASSIGN_TO_HIGHEST_VALUE_ITEM' },
          },
        },
      });

      const result = await service.validateRevision('pb1', 'rev1');

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('publishRevision', () => {
    it('throws REVISION_NOT_DRAFT when revision is not draft', async () => {
      mockRevisionRepo.findOne.mockResolvedValue({
        id: 'rev1',
        pricebookId: 'pb1',
        status: 'PUBLISHED',
        currencyCode: 'KES',
        configSnapshot: { version: '1.0', currency: 'KES' },
      });

      await expect(
        service.publishRevision('pb1', 'rev1', {
          effectiveFrom: '2026-02-01T00:00:00Z',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws CONFIG_SCHEMA_INVALID when validation fails', async () => {
      mockRevisionRepo.findOne.mockResolvedValue({
        id: 'rev1',
        pricebookId: 'pb1',
        status: 'DRAFT',
        currencyCode: 'KES',
        configSnapshot: { currency: 'KES' }, // Missing version
      });

      await expect(
        service.publishRevision('pb1', 'rev1', {
          effectiveFrom: '2026-02-01T00:00:00Z',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('publishes revision successfully', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockRevisionRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockRevisionRepo.findOne.mockResolvedValue({
        id: 'rev1',
        pricebookId: 'pb1',
        status: 'DRAFT',
        currencyCode: 'KES',
        configSnapshot: { version: '1.0', currency: 'KES' },
      });
      mockRevisionRepo.save.mockResolvedValue({
        id: 'rev1',
        pricebookId: 'pb1',
        status: 'PUBLISHED',
        effectiveFrom: new Date('2026-02-01'),
        publishedAt: new Date(),
      });
      mockEventBus.emit.mockResolvedValue(undefined);

      const result = await service.publishRevision('pb1', 'rev1', {
        effectiveFrom: '2026-02-01T00:00:00Z',
      });

      expect(result.status).toBe('PUBLISHED');
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'pricebook.revision.published',
        expect.any(Object),
      );
    });
  });

  describe('updateRevision', () => {
    it('throws REVISION_NOT_DRAFT when trying to update non-draft', async () => {
      mockRevisionRepo.findOne.mockResolvedValue({
        id: 'rev1',
        pricebookId: 'pb1',
        status: 'PUBLISHED',
        currencyCode: 'KES',
        configSnapshot: { version: '1.0', currency: 'KES' },
      });

      await expect(
        service.updateRevision('pb1', 'rev1', {
          configSnapshot: { version: '1.1', currency: 'KES' },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates draft revision successfully', async () => {
      mockRevisionRepo.findOne.mockResolvedValue({
        id: 'rev1',
        pricebookId: 'pb1',
        status: 'DRAFT',
        currencyCode: 'KES',
        configSnapshot: { version: '1.0', currency: 'KES' },
      });
      mockPriceListRepo.findBy.mockResolvedValue([]);
      mockRevisionRepo.save.mockResolvedValue({
        id: 'rev1',
        pricebookId: 'pb1',
        status: 'DRAFT',
        currencyCode: 'KES',
        configSnapshot: { version: '1.1', currency: 'KES' },
      });

      const result = await service.updateRevision('pb1', 'rev1', {
        configSnapshot: { version: '1.1', currency: 'KES' },
      });

      expect(result.configSnapshot.version).toBe('1.1');
    });
  });
});
