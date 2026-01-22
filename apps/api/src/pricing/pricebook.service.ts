import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Pricebook } from './entities/pricebook.entity';
import { PricebookRevision, PricebookRevisionStatus, PricebookConfigSnapshot } from './entities/pricebook-revision.entity';
import { Channel } from '../channels/entities/channel.entity';
import { CustomerGroup } from '../customer-group/entities/customer-group.entity';
import { SalesChannel } from '../catalog/entities/sales-channel.entity';
import { PriceList } from '../catalog/entities/price-list.entity';
import { CurrencyService } from '../currency/currency.service';
import {
  CreatePricebookDto,
  UpdatePricebookDto,
  CreatePricebookRevisionDto,
  UpdatePricebookRevisionDto,
  PublishPricebookRevisionDto,
  RevisionValidationResult,
} from './dto';
import { EventBusService } from '../queue/event-bus.service';

const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class PricebookService {
  private readonly logger = new Logger(PricebookService.name);

  constructor(
    @InjectRepository(Pricebook)
    private readonly pricebookRepo: Repository<Pricebook>,
    @InjectRepository(PricebookRevision)
    private readonly revisionRepo: Repository<PricebookRevision>,
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    @InjectRepository(CustomerGroup)
    private readonly customerGroupRepo: Repository<CustomerGroup>,
    @InjectRepository(SalesChannel)
    private readonly salesChannelRepo: Repository<SalesChannel>,
    @InjectRepository(PriceList)
    private readonly priceListRepo: Repository<PriceList>,
    private readonly currencyService: CurrencyService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create a new pricebook
   */
  async createPricebook(dto: CreatePricebookDto): Promise<Pricebook> {
    // Check for duplicate code
    const existing = await this.pricebookRepo.findOne({
      where: { tenantId: SYSTEM_TENANT_ID, code: dto.code },
    });
    if (existing) {
      throw new ConflictException({
        code: 'PRICEBOOK_CODE_EXISTS',
        message: `Pricebook with code '${dto.code}' already exists`,
      });
    }

    // Resolve relations
    const channels = dto.channelIds?.length
      ? await this.channelRepo.findBy({ id: In(dto.channelIds) })
      : [];
    const customerGroups = dto.customerGroupIds?.length
      ? await this.customerGroupRepo.findBy({ id: In(dto.customerGroupIds) })
      : [];
    const salesChannels = dto.salesChannelIds?.length
      ? await this.salesChannelRepo.findBy({ id: In(dto.salesChannelIds) })
      : [];

    const pricebook = this.pricebookRepo.create({
      tenantId: SYSTEM_TENANT_ID,
      code: dto.code,
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive ?? true,
      channels,
      customerGroups,
      salesChannels,
    });

    const saved = await this.pricebookRepo.save(pricebook);

    this.logger.log(`Pricebook created: ${saved.id} (${saved.code})`);
    await this.eventBus.emit('pricebook.created', { pricebookId: saved.id, code: saved.code });

    return saved;
  }

  /**
   * Get pricebook by ID
   */
  async getPricebook(id: string): Promise<Pricebook> {
    const pricebook = await this.pricebookRepo.findOne({
      where: { id },
      relations: ['channels', 'customerGroups', 'salesChannels', 'revisions'],
    });
    if (!pricebook) {
      throw new NotFoundException({
        code: 'PRICEBOOK_NOT_FOUND',
        message: `Pricebook with ID '${id}' not found`,
      });
    }
    return pricebook;
  }

  /**
   * Get pricebook by code
   */
  async getPricebookByCode(code: string): Promise<Pricebook> {
    const pricebook = await this.pricebookRepo.findOne({
      where: { tenantId: SYSTEM_TENANT_ID, code },
      relations: ['channels', 'customerGroups', 'salesChannels'],
    });
    if (!pricebook) {
      throw new NotFoundException({
        code: 'PRICEBOOK_NOT_FOUND',
        message: `Pricebook with code '${code}' not found`,
      });
    }
    return pricebook;
  }

  /**
   * List all pricebooks
   */
  async listPricebooks(options?: {
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: Pricebook[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const qb = this.pricebookRepo
      .createQueryBuilder('pb')
      .leftJoinAndSelect('pb.channels', 'channels')
      .leftJoinAndSelect('pb.customerGroups', 'customerGroups')
      .leftJoinAndSelect('pb.salesChannels', 'salesChannels')
      .where('pb.tenant_id = :tenantId', { tenantId: SYSTEM_TENANT_ID })
      .orderBy('pb.created_at', 'DESC');

    if (typeof options?.isActive === 'boolean') {
      qb.andWhere('pb.is_active = :isActive', { isActive: options.isActive });
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return { data, total };
  }

  /**
   * Update a pricebook
   */
  async updatePricebook(id: string, dto: UpdatePricebookDto): Promise<Pricebook> {
    const pricebook = await this.getPricebook(id);

    if (dto.code && dto.code !== pricebook.code) {
      const dup = await this.pricebookRepo.findOne({
        where: { tenantId: SYSTEM_TENANT_ID, code: dto.code },
      });
      if (dup) {
        throw new ConflictException({
          code: 'PRICEBOOK_CODE_EXISTS',
          message: `Pricebook with code '${dto.code}' already exists`,
        });
      }
      pricebook.code = dto.code;
    }

    if (dto.name !== undefined) pricebook.name = dto.name;
    if (dto.description !== undefined) pricebook.description = dto.description;
    if (dto.isActive !== undefined) pricebook.isActive = dto.isActive;

    if (dto.channelIds !== undefined) {
      pricebook.channels = dto.channelIds.length
        ? await this.channelRepo.findBy({ id: In(dto.channelIds) })
        : [];
    }
    if (dto.customerGroupIds !== undefined) {
      pricebook.customerGroups = dto.customerGroupIds.length
        ? await this.customerGroupRepo.findBy({ id: In(dto.customerGroupIds) })
        : [];
    }
    if (dto.salesChannelIds !== undefined) {
      pricebook.salesChannels = dto.salesChannelIds.length
        ? await this.salesChannelRepo.findBy({ id: In(dto.salesChannelIds) })
        : [];
    }

    return this.pricebookRepo.save(pricebook);
  }

  /**
   * Delete a pricebook (soft delete via is_active = false, or hard delete)
   */
  async deletePricebook(id: string, hard = false): Promise<{ deleted: boolean }> {
    const pricebook = await this.getPricebook(id);
    if (hard) {
      await this.pricebookRepo.remove(pricebook);
    } else {
      pricebook.isActive = false;
      await this.pricebookRepo.save(pricebook);
    }
    return { deleted: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REVISION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new revision (draft)
   */
  async createRevision(
    pricebookId: string,
    dto: CreatePricebookRevisionDto,
  ): Promise<PricebookRevision> {
    const pricebook = await this.getPricebook(pricebookId);

    // Validate currency
    await this.currencyService.assertExists(dto.currency);

    // Validate config snapshot currency matches
    if (dto.configSnapshot.currency !== dto.currency) {
      throw new ConflictException({
        code: 'CONFIG_SCHEMA_INVALID',
        message: `Config snapshot currency (${dto.configSnapshot.currency}) must match revision currency (${dto.currency})`,
      });
    }

    // Get next revision number
    const lastRevision = await this.revisionRepo.findOne({
      where: { pricebookId },
      order: { revisionNumber: 'DESC' },
    });
    const nextRevisionNumber = (lastRevision?.revisionNumber ?? 0) + 1;

    // Resolve price lists
    const priceLists = dto.priceListIds?.length
      ? await this.priceListRepo.findBy({ id: In(dto.priceListIds) })
      : [];

    const revision = this.revisionRepo.create({
      tenantId: SYSTEM_TENANT_ID,
      pricebookId,
      revisionNumber: nextRevisionNumber,
      status: 'DRAFT' as PricebookRevisionStatus,
      currencyCode: dto.currency.toUpperCase(),
      configSnapshot: dto.configSnapshot as PricebookConfigSnapshot,
      priceLists,
    });

    const saved = await this.revisionRepo.save(revision);

    this.logger.log(`Revision created: ${saved.id} (pricebook: ${pricebookId}, rev: ${nextRevisionNumber})`);
    await this.eventBus.emit('pricebook.revision.created', {
      pricebookId,
      revisionId: saved.id,
      revisionNumber: nextRevisionNumber,
    });

    return saved;
  }

  /**
   * Get revision by ID
   */
  async getRevision(pricebookId: string, revisionId: string): Promise<PricebookRevision> {
    const revision = await this.revisionRepo.findOne({
      where: { id: revisionId, pricebookId },
      relations: ['pricebook', 'priceLists'],
    });
    if (!revision) {
      throw new NotFoundException({
        code: 'REVISION_NOT_FOUND',
        message: `Revision '${revisionId}' not found for pricebook '${pricebookId}'`,
      });
    }
    return revision;
  }

  /**
   * List revisions for a pricebook
   */
  async listRevisions(
    pricebookId: string,
    options?: { status?: PricebookRevisionStatus },
  ): Promise<PricebookRevision[]> {
    const qb = this.revisionRepo
      .createQueryBuilder('rev')
      .leftJoinAndSelect('rev.priceLists', 'priceLists')
      .where('rev.pricebook_id = :pricebookId', { pricebookId })
      .orderBy('rev.revision_number', 'DESC');

    if (options?.status) {
      qb.andWhere('rev.status = :status', { status: options.status });
    }

    return qb.getMany();
  }

  /**
   * Update a revision (draft only)
   */
  async updateRevision(
    pricebookId: string,
    revisionId: string,
    dto: UpdatePricebookRevisionDto,
  ): Promise<PricebookRevision> {
    const revision = await this.getRevision(pricebookId, revisionId);

    if (revision.status !== 'DRAFT') {
      throw new ConflictException({
        code: 'REVISION_NOT_DRAFT',
        message: `Revision '${revisionId}' is not in DRAFT status and cannot be modified`,
      });
    }

    if (dto.configSnapshot) {
      // Validate currency consistency
      if (dto.configSnapshot.currency && dto.configSnapshot.currency !== revision.currencyCode) {
        throw new ConflictException({
          code: 'CONFIG_SCHEMA_INVALID',
          message: `Cannot change config currency to ${dto.configSnapshot.currency}; revision currency is ${revision.currencyCode}`,
        });
      }
      revision.configSnapshot = dto.configSnapshot as PricebookConfigSnapshot;
    }

    if (dto.effectiveFrom !== undefined) {
      revision.effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined;
    }
    if (dto.effectiveTo !== undefined) {
      revision.effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : undefined;
    }

    if (dto.priceListIds !== undefined) {
      revision.priceLists = dto.priceListIds.length
        ? await this.priceListRepo.findBy({ id: In(dto.priceListIds) })
        : [];
    }

    return this.revisionRepo.save(revision);
  }

  /**
   * Validate a revision (publish gate checks)
   */
  async validateRevision(
    pricebookId: string,
    revisionId: string,
  ): Promise<RevisionValidationResult> {
    const revision = await this.getRevision(pricebookId, revisionId);
    const issues: Array<{ code: string; path: string; message: string }> = [];

    const config = revision.configSnapshot;

    // Check version
    if (!config.version) {
      issues.push({ code: 'MISSING_FIELD', path: 'version', message: 'version is required' });
    }

    // Check currency consistency
    if (!config.currency) {
      issues.push({ code: 'MISSING_FIELD', path: 'currency', message: 'currency is required' });
    } else if (config.currency !== revision.currencyCode) {
      issues.push({
        code: 'CURRENCY_MISMATCH',
        path: 'currency',
        message: `Config currency (${config.currency}) does not match revision currency (${revision.currencyCode})`,
      });
    }

    // Check tax configuration
    if (config.tax) {
      if (!config.tax.mode || !['INCLUSIVE', 'EXCLUSIVE'].includes(config.tax.mode)) {
        issues.push({
          code: 'INVALID_VALUE',
          path: 'tax.mode',
          message: 'tax.mode must be INCLUSIVE or EXCLUSIVE',
        });
      }
      if (config.tax.vatRate === undefined || config.tax.vatRate < 0 || config.tax.vatRate > 1) {
        issues.push({
          code: 'INVALID_VALUE',
          path: 'tax.vatRate',
          message: 'tax.vatRate must be between 0 and 1',
        });
      }
    }

    // Check allocation rules
    if (config.allocation) {
      if (!config.allocation.rules?.DISCOUNT) {
        issues.push({
          code: 'MISSING_FIELD',
          path: 'allocation.rules.DISCOUNT',
          message: 'allocation.rules.DISCOUNT is required',
        });
      }
      if (!config.allocation.rules?.SHIPPING) {
        issues.push({
          code: 'MISSING_FIELD',
          path: 'allocation.rules.SHIPPING',
          message: 'allocation.rules.SHIPPING is required',
        });
      }
      if (!config.allocation.residual?.strategy) {
        issues.push({
          code: 'MISSING_FIELD',
          path: 'allocation.residual.strategy',
          message: 'allocation.residual.strategy is required',
        });
      }
    }

    // Check shipping config
    if (config.shipping?.ratingStrategy === 'CARRIER_QUOTE' && !config.shipping.fallbackStrategy) {
      issues.push({
        code: 'MISSING_FIELD',
        path: 'shipping.fallbackStrategy',
        message: 'shipping.fallbackStrategy is required when ratingStrategy is CARRIER_QUOTE',
      });
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Publish a revision
   */
  async publishRevision(
    pricebookId: string,
    revisionId: string,
    dto: PublishPricebookRevisionDto,
  ): Promise<PricebookRevision> {
    const revision = await this.getRevision(pricebookId, revisionId);

    if (revision.status !== 'DRAFT') {
      throw new ConflictException({
        code: 'REVISION_NOT_DRAFT',
        message: `Revision '${revisionId}' is not in DRAFT status`,
      });
    }

    // Run validation
    const validation = await this.validateRevision(pricebookId, revisionId);
    if (!validation.valid) {
      throw new ConflictException({
        code: 'CONFIG_SCHEMA_INVALID',
        message: 'Revision failed validation',
        details: validation.issues,
      });
    }

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    // Check for overlapping published revisions
    const overlapping = await this.findOverlappingRevisions(
      pricebookId,
      revision.currencyCode,
      effectiveFrom,
      effectiveTo,
      revisionId,
    );
    if (overlapping.length > 0) {
      throw new ConflictException({
        code: 'OVERLAPPING_EFFECTIVE_WINDOW',
        message: `Overlapping published revision(s) found: ${overlapping.map((r) => r.id).join(', ')}`,
      });
    }

    revision.status = 'PUBLISHED';
    revision.effectiveFrom = effectiveFrom;
    revision.effectiveTo = effectiveTo ?? undefined;
    revision.publishedAt = new Date();

    const saved = await this.revisionRepo.save(revision);

    this.logger.log(`Revision published: ${saved.id}`);
    await this.eventBus.emit('pricebook.revision.published', {
      pricebookId,
      revisionId: saved.id,
      revisionNumber: saved.revisionNumber,
      effectiveFrom: saved.effectiveFrom,
      effectiveTo: saved.effectiveTo,
    });

    return saved;
  }

  /**
   * Deprecate a revision (set effective_to to now)
   */
  async deprecateRevision(
    pricebookId: string,
    revisionId: string,
  ): Promise<PricebookRevision> {
    const revision = await this.getRevision(pricebookId, revisionId);

    if (revision.status !== 'PUBLISHED') {
      throw new ConflictException({
        code: 'REVISION_NOT_PUBLISHED',
        message: `Revision '${revisionId}' is not in PUBLISHED status`,
      });
    }

    revision.status = 'DEPRECATED';
    revision.effectiveTo = new Date();

    const saved = await this.revisionRepo.save(revision);

    this.logger.log(`Revision deprecated: ${saved.id}`);
    await this.eventBus.emit('pricebook.revision.deprecated', {
      pricebookId,
      revisionId: saved.id,
    });

    return saved;
  }

  /**
   * Clone a revision to create a new draft
   */
  async cloneRevision(
    pricebookId: string,
    revisionId: string,
  ): Promise<PricebookRevision> {
    const source = await this.getRevision(pricebookId, revisionId);

    return this.createRevision(pricebookId, {
      currency: source.currencyCode,
      configSnapshot: { ...source.configSnapshot },
      priceListIds: source.priceLists?.map((pl) => pl.id),
    });
  }

  /**
   * Find overlapping published revisions for the same pricebook + currency
   */
  private async findOverlappingRevisions(
    pricebookId: string,
    currencyCode: string,
    effectiveFrom: Date,
    effectiveTo: Date | null,
    excludeRevisionId?: string,
  ): Promise<PricebookRevision[]> {
    const qb = this.revisionRepo
      .createQueryBuilder('rev')
      .where('rev.pricebook_id = :pricebookId', { pricebookId })
      .andWhere('rev.currency_code = :currencyCode', { currencyCode })
      .andWhere('rev.status = :status', { status: 'PUBLISHED' });

    if (excludeRevisionId) {
      qb.andWhere('rev.id != :excludeRevisionId', { excludeRevisionId });
    }

    // Check for overlap:
    // [A, B] overlaps [C, D] if A < D AND C < B (when both ends exist)
    // Handle null effective_to as infinity
    if (effectiveTo) {
      qb.andWhere(
        '(rev.effective_from < :effectiveTo) AND (rev.effective_to IS NULL OR :effectiveFrom < rev.effective_to)',
        { effectiveFrom, effectiveTo },
      );
    } else {
      qb.andWhere(
        '(rev.effective_to IS NULL OR :effectiveFrom < rev.effective_to)',
        { effectiveFrom },
      );
    }

    return qb.getMany();
  }
}
