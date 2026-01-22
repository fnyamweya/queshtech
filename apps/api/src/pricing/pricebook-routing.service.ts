import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { PricebookAssignment } from './entities/pricebook-assignment.entity';
import { PricebookRevision } from './entities/pricebook-revision.entity';
import { Pricebook } from './entities/pricebook.entity';
import { ResolvePricebookDto, PricebookResolutionResponse } from './dto/pricebook-routing.dto';

const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Order context for pricebook routing
 */
export interface OrderContext {
  tenantId?: string;
  channelId?: string;
  customerGroupId?: string;
  countryCode?: string;
  salesChannelId?: string;
  merchantId?: string;
  currency: string;
}

@Injectable()
export class PricebookRoutingService {
  private readonly logger = new Logger(PricebookRoutingService.name);

  constructor(
    @InjectRepository(PricebookAssignment)
    private readonly assignmentRepo: Repository<PricebookAssignment>,
    @InjectRepository(PricebookRevision)
    private readonly revisionRepo: Repository<PricebookRevision>,
    @InjectRepository(Pricebook)
    private readonly pricebookRepo: Repository<Pricebook>,
  ) {}

  /**
   * Resolve the effective pricebook + revision for an order context
   */
  async resolvePricebook(dto: ResolvePricebookDto): Promise<PricebookResolutionResponse> {
    const at = dto.at ? new Date(dto.at) : new Date();
    const tenantId = SYSTEM_TENANT_ID;

    const context: OrderContext = {
      tenantId,
      channelId: dto.channelId,
      customerGroupId: dto.customerGroupId,
      countryCode: dto.countryCode,
      salesChannelId: dto.salesChannelId,
      merchantId: dto.merchantId,
      currency: dto.currency.toUpperCase(),
    };

    // Step 1: Find matching assignment
    const assignment = await this.findBestAssignment(context);
    if (!assignment) {
      throw new NotFoundException({
        code: 'NO_DEFAULT_ASSIGNMENT',
        message: 'No active pricebook assignment found for the given context',
      });
    }

    // Step 2: Find effective published revision
    const revision = await this.findEffectiveRevision(
      assignment.pricebookId,
      context.currency,
      at,
    );
    if (!revision) {
      throw new NotFoundException({
        code: 'NO_PUBLISHED_REVISION_EFFECTIVE',
        message: `No effective published revision found for pricebook '${assignment.pricebookId}' with currency '${context.currency}' at ${at.toISOString()}`,
      });
    }

    // Step 3: Load pricebook details
    const pricebook = await this.pricebookRepo.findOne({
      where: { id: assignment.pricebookId },
    });

    return {
      pricebookId: assignment.pricebookId,
      pricebookCode: pricebook?.code ?? '',
      pricebookRevisionId: revision.id,
      revisionNumber: revision.revisionNumber,
      currency: revision.currencyCode,
      effectiveFrom: revision.effectiveFrom ?? null,
      effectiveTo: revision.effectiveTo ?? null,
      routing: {
        assignmentId: assignment.id,
        priority: assignment.priority,
        specificityScore: assignment.computeSpecificityScore(),
      },
    };
  }

  /**
   * Find the best matching assignment for an order context
   * Uses priority-based routing with specificity scoring
   */
  async findBestAssignment(context: OrderContext): Promise<PricebookAssignment | null> {
    const tenantId = context.tenantId ?? SYSTEM_TENANT_ID;

    // Fetch all active assignments for tenant
    const assignments = await this.assignmentRepo.find({
      where: { tenantId, isActive: true },
      order: { priority: 'DESC' },
      relations: ['pricebook'],
    });

    if (assignments.length === 0) {
      return null;
    }

    // Score and filter assignments
    const scoredAssignments = assignments
      .map((a) => ({
        assignment: a,
        matchScore: this.computeMatchScore(a, context),
        specificityScore: a.computeSpecificityScore(),
      }))
      .filter((s) => s.matchScore >= 0) // matchScore < 0 means mismatch
      .sort((a, b) => {
        // 1. Higher priority wins
        if (b.assignment.priority !== a.assignment.priority) {
          return b.assignment.priority - a.assignment.priority;
        }
        // 2. Higher match score wins
        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore;
        }
        // 3. Higher specificity wins (tie-breaker)
        return b.specificityScore - a.specificityScore;
      });

    return scoredAssignments.length > 0 ? scoredAssignments[0].assignment : null;
  }

  /**
   * Compute match score for an assignment against context
   * Returns -1 if mismatch (explicit value doesn't match)
   * Returns score >= 0 for matches (exact match beats wildcard)
   */
  private computeMatchScore(
    assignment: PricebookAssignment,
    context: OrderContext,
  ): number {
    let score = 0;

    // Channel
    if (assignment.channelId) {
      if (context.channelId && assignment.channelId === context.channelId) {
        score += 2; // Exact match
      } else if (context.channelId) {
        return -1; // Mismatch
      }
    }

    // Customer group
    if (assignment.customerGroupId) {
      if (context.customerGroupId && assignment.customerGroupId === context.customerGroupId) {
        score += 4; // Higher weight for customer group
      } else if (context.customerGroupId) {
        return -1;
      }
    }

    // Country
    if (assignment.countryCode) {
      if (context.countryCode && assignment.countryCode === context.countryCode) {
        score += 2;
      } else if (context.countryCode) {
        return -1;
      }
    }

    // Sales channel
    if (assignment.salesChannelId) {
      if (context.salesChannelId && assignment.salesChannelId === context.salesChannelId) {
        score += 2;
      } else if (context.salesChannelId) {
        return -1;
      }
    }

    // Merchant
    if (assignment.merchantId) {
      if (context.merchantId && assignment.merchantId === context.merchantId) {
        score += 8; // Highest weight for merchant-specific
      } else if (context.merchantId) {
        return -1;
      }
    }

    return score;
  }

  /**
   * Find the effective published revision for a pricebook + currency at a given time
   */
  async findEffectiveRevision(
    pricebookId: string,
    currency: string,
    at: Date,
  ): Promise<PricebookRevision | null> {
    // Query for eligible revisions:
    // - status = PUBLISHED
    // - currency matches
    // - effective_from <= at
    // - effective_to is null OR at < effective_to
    const qb = this.revisionRepo
      .createQueryBuilder('rev')
      .leftJoinAndSelect('rev.priceLists', 'priceLists')
      .where('rev.pricebook_id = :pricebookId', { pricebookId })
      .andWhere('rev.status = :status', { status: 'PUBLISHED' })
      .andWhere('rev.currency_code = :currency', { currency: currency.toUpperCase() })
      .andWhere('rev.effective_from <= :at', { at })
      .andWhere('(rev.effective_to IS NULL OR :at < rev.effective_to)', { at })
      // Selection: latest effective_from, then highest revision_number
      .orderBy('rev.effective_from', 'DESC')
      .addOrderBy('rev.revision_number', 'DESC')
      .limit(1);

    return qb.getOne();
  }

  /**
   * Get effective revision at a specific time (convenience method)
   */
  async getEffectiveRevisionAt(
    pricebookId: string,
    currency: string,
    at?: Date | string,
  ): Promise<PricebookRevision | null> {
    const timestamp = at ? new Date(at) : new Date();
    return this.findEffectiveRevision(pricebookId, currency, timestamp);
  }

  /**
   * Get the default pricebook (single-channel posture)
   */
  async getDefaultPricebook(): Promise<Pricebook | null> {
    const assignment = await this.assignmentRepo.findOne({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        isActive: true,
        channelId: IsNull(),
        customerGroupId: IsNull(),
        countryCode: IsNull(),
        salesChannelId: IsNull(),
        merchantId: IsNull(),
      },
      relations: ['pricebook'],
    });

    return assignment?.pricebook ?? null;
  }
}
