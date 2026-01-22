import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PricebookRoutingService, OrderContext } from '../pricebook-routing.service';
import { PricebookAssignment } from '../entities/pricebook-assignment.entity';
import { PricebookRevision } from '../entities/pricebook-revision.entity';
import { Pricebook } from '../entities/pricebook.entity';
import { NotFoundException } from '@nestjs/common';

describe('PricebookRoutingService', () => {
  let service: PricebookRoutingService;

  const mockAssignmentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const mockRevisionRepo = {
    createQueryBuilder: jest.fn(),
  };
  const mockPricebookRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricebookRoutingService,
        { provide: getRepositoryToken(PricebookAssignment), useValue: mockAssignmentRepo },
        { provide: getRepositoryToken(PricebookRevision), useValue: mockRevisionRepo },
        { provide: getRepositoryToken(Pricebook), useValue: mockPricebookRepo },
      ],
    }).compile();

    service = module.get<PricebookRoutingService>(PricebookRoutingService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('findBestAssignment', () => {
    it('returns null when no assignments exist', async () => {
      mockAssignmentRepo.find.mockResolvedValue([]);

      const context: OrderContext = { currency: 'KES' };
      const result = await service.findBestAssignment(context);

      expect(result).toBeNull();
    });

    it('returns the default assignment (all nulls) when no specific match', async () => {
      const defaultAssignment = createMockAssignment({
        id: 'default',
        pricebookId: 'pb1',
        priority: 0,
      });
      mockAssignmentRepo.find.mockResolvedValue([defaultAssignment]);

      const context: OrderContext = { currency: 'KES' };
      const result = await service.findBestAssignment(context);

      expect(result?.id).toBe('default');
    });

    it('prefers higher priority assignment', async () => {
      const lowPriority = createMockAssignment({
        id: 'low',
        pricebookId: 'pb1',
        priority: 0,
      });
      const highPriority = createMockAssignment({
        id: 'high',
        pricebookId: 'pb2',
        priority: 10,
      });
      mockAssignmentRepo.find.mockResolvedValue([highPriority, lowPriority]);

      const context: OrderContext = { currency: 'KES' };
      const result = await service.findBestAssignment(context);

      expect(result?.id).toBe('high');
    });

    it('prefers exact channel match over wildcard', async () => {
      const wildcard = createMockAssignment({
        id: 'wildcard',
        pricebookId: 'pb1',
        priority: 10,
      });
      const channelMatch = createMockAssignment({
        id: 'channel',
        pricebookId: 'pb2',
        priority: 10,
        channelId: 'ch1',
      });
      mockAssignmentRepo.find.mockResolvedValue([channelMatch, wildcard]);

      const context: OrderContext = { currency: 'KES', channelId: 'ch1' };
      const result = await service.findBestAssignment(context);

      expect(result?.id).toBe('channel');
    });

    it('filters out mismatched channel assignments', async () => {
      const wrongChannel = createMockAssignment({
        id: 'wrong',
        pricebookId: 'pb1',
        priority: 10,
        channelId: 'ch2',
      });
      const wildcard = createMockAssignment({
        id: 'wildcard',
        pricebookId: 'pb2',
        priority: 5,
      });
      mockAssignmentRepo.find.mockResolvedValue([wrongChannel, wildcard]);

      const context: OrderContext = { currency: 'KES', channelId: 'ch1' };
      const result = await service.findBestAssignment(context);

      expect(result?.id).toBe('wildcard');
    });

    it('prefers customer group match over channel match (higher weight)', async () => {
      const channelOnly = createMockAssignment({
        id: 'channel',
        pricebookId: 'pb1',
        priority: 10,
        channelId: 'ch1',
      });
      const customerGroupOnly = createMockAssignment({
        id: 'customerGroup',
        pricebookId: 'pb2',
        priority: 10,
        customerGroupId: 'cg1',
      });
      mockAssignmentRepo.find.mockResolvedValue([channelOnly, customerGroupOnly]);

      const context: OrderContext = {
        currency: 'KES',
        channelId: 'ch1',
        customerGroupId: 'cg1',
      };
      const result = await service.findBestAssignment(context);

      expect(result?.id).toBe('customerGroup');
    });

    it('prefers merchant-specific assignment (highest weight)', async () => {
      const generic = createMockAssignment({
        id: 'generic',
        pricebookId: 'pb1',
        priority: 10,
      });
      const merchantSpecific = createMockAssignment({
        id: 'merchant',
        pricebookId: 'pb2',
        priority: 10,
        merchantId: 'm1',
      });
      mockAssignmentRepo.find.mockResolvedValue([generic, merchantSpecific]);

      const context: OrderContext = { currency: 'KES', merchantId: 'm1' };
      const result = await service.findBestAssignment(context);

      expect(result?.id).toBe('merchant');
    });

    it('uses specificity score as tiebreaker', async () => {
      const lessSpecific = createMockAssignment({
        id: 'less',
        pricebookId: 'pb1',
        priority: 10,
        channelId: 'ch1',
      });
      const moreSpecific = createMockAssignment({
        id: 'more',
        pricebookId: 'pb2',
        priority: 10,
        channelId: 'ch1',
        countryCode: 'KE',
      });
      mockAssignmentRepo.find.mockResolvedValue([lessSpecific, moreSpecific]);

      const context: OrderContext = {
        currency: 'KES',
        channelId: 'ch1',
        countryCode: 'KE',
      };
      const result = await service.findBestAssignment(context);

      expect(result?.id).toBe('more');
    });
  });

  describe('findEffectiveRevision', () => {
    it('returns the effective revision for given time', async () => {
      const mockRevision = {
        id: 'rev1',
        pricebookId: 'pb1',
        revisionNumber: 1,
        status: 'PUBLISHED',
        currencyCode: 'KES',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
      };

      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockRevision),
      };
      mockRevisionRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findEffectiveRevision(
        'pb1',
        'KES',
        new Date('2026-01-15'),
      );

      expect(result?.id).toBe('rev1');
      expect(mockQb.andWhere).toHaveBeenCalledWith('rev.status = :status', {
        status: 'PUBLISHED',
      });
    });

    it('returns null when no effective revision exists', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockRevisionRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findEffectiveRevision(
        'pb1',
        'KES',
        new Date('2026-01-15'),
      );

      expect(result).toBeNull();
    });
  });

  describe('resolvePricebook', () => {
    it('throws NO_DEFAULT_ASSIGNMENT when no assignment found', async () => {
      mockAssignmentRepo.find.mockResolvedValue([]);

      await expect(
        service.resolvePricebook({ currency: 'KES' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NO_PUBLISHED_REVISION_EFFECTIVE when no revision found', async () => {
      const assignment = createMockAssignment({
        id: 'default',
        pricebookId: 'pb1',
        priority: 0,
      });
      mockAssignmentRepo.find.mockResolvedValue([assignment]);

      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockRevisionRepo.createQueryBuilder.mockReturnValue(mockQb);

      await expect(
        service.resolvePricebook({ currency: 'KES' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns full resolution when assignment and revision found', async () => {
      const assignment = createMockAssignment({
        id: 'default',
        pricebookId: 'pb1',
        priority: 0,
      });
      mockAssignmentRepo.find.mockResolvedValue([assignment]);

      const revision = {
        id: 'rev1',
        pricebookId: 'pb1',
        revisionNumber: 5,
        status: 'PUBLISHED',
        currencyCode: 'KES',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
      };
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(revision),
      };
      mockRevisionRepo.createQueryBuilder.mockReturnValue(mockQb);

      mockPricebookRepo.findOne.mockResolvedValue({ id: 'pb1', code: 'DEFAULT' });

      const result = await service.resolvePricebook({ currency: 'KES' });

      expect(result.pricebookId).toBe('pb1');
      expect(result.pricebookCode).toBe('DEFAULT');
      expect(result.pricebookRevisionId).toBe('rev1');
      expect(result.revisionNumber).toBe(5);
      expect(result.currency).toBe('KES');
      expect(result.routing.assignmentId).toBe('default');
      expect(result.routing.priority).toBe(0);
    });
  });
});

function createMockAssignment(overrides: Partial<PricebookAssignment>): PricebookAssignment {
  const assignment = new PricebookAssignment();
  Object.assign(assignment, {
    id: 'mock-id',
    tenantId: '00000000-0000-0000-0000-000000000000',
    pricebookId: 'pb-mock',
    channelId: undefined,
    customerGroupId: undefined,
    countryCode: undefined,
    salesChannelId: undefined,
    merchantId: undefined,
    priority: 0,
    isActive: true,
    conditionsJson: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return assignment;
}
