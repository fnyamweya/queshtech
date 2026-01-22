import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderPricingSnapshot, PricingRuntimeContext } from './entities/order-pricing-snapshot.entity';
import { PricebookRevision } from './entities/pricebook-revision.entity';
import { UpsertOrderPricingSnapshotDto } from './dto/pricebook-routing.dto';
import { EventBusService } from '../queue/event-bus.service';

const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class PricingSnapshotService {
  private readonly logger = new Logger(PricingSnapshotService.name);

  constructor(
    @InjectRepository(OrderPricingSnapshot)
    private readonly snapshotRepo: Repository<OrderPricingSnapshot>,
    @InjectRepository(PricebookRevision)
    private readonly revisionRepo: Repository<PricebookRevision>,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Upsert an order pricing snapshot (only if unlocked)
   */
  async upsertSnapshot(
    orderId: string,
    dto: UpsertOrderPricingSnapshotDto,
  ): Promise<OrderPricingSnapshot> {
    // Check if snapshot already exists
    const existing = await this.snapshotRepo.findOne({
      where: { orderId },
    });

    if (existing?.isLocked()) {
      throw new ConflictException({
        code: 'SNAPSHOT_LOCKED',
        message: `Pricing snapshot for order '${orderId}' is locked and cannot be modified`,
      });
    }

    // Validate revision exists and is published + effective
    const revision = await this.revisionRepo.findOne({
      where: { id: dto.pricebookRevisionId },
    });
    if (!revision) {
      throw new NotFoundException({
        code: 'REVISION_NOT_FOUND',
        message: `Revision '${dto.pricebookRevisionId}' not found`,
      });
    }

    if (revision.status !== 'PUBLISHED') {
      throw new ConflictException({
        code: 'REVISION_NOT_PUBLISHED_OR_NOT_EFFECTIVE',
        message: `Revision '${dto.pricebookRevisionId}' is not published`,
      });
    }

    // Check if revision is currently effective
    const now = new Date();
    const isEffective =
      revision.effectiveFrom &&
      revision.effectiveFrom <= now &&
      (!revision.effectiveTo || now < revision.effectiveTo);

    if (!isEffective) {
      throw new ConflictException({
        code: 'REVISION_NOT_PUBLISHED_OR_NOT_EFFECTIVE',
        message: `Revision '${dto.pricebookRevisionId}' is not currently effective`,
      });
    }

    if (existing) {
      // Update existing snapshot
      existing.pricebookRevisionId = dto.pricebookRevisionId;
      existing.currencyCode = dto.currency.toUpperCase();
      existing.pricingEngineVersion = dto.pricingEngineVersion ?? existing.pricingEngineVersion;
      existing.runtimeContext = (dto.runtimeContext ?? existing.runtimeContext) as PricingRuntimeContext;

      const saved = await this.snapshotRepo.save(existing);
      this.logger.log(`Pricing snapshot updated for order: ${orderId}`);
      return saved;
    }

    // Create new snapshot
    const snapshot = this.snapshotRepo.create({
      tenantId: SYSTEM_TENANT_ID,
      orderId,
      pricebookRevisionId: dto.pricebookRevisionId,
      currencyCode: dto.currency.toUpperCase(),
      pricingEngineVersion: dto.pricingEngineVersion ?? '1.0.0',
      runtimeContext: (dto.runtimeContext ?? {}) as PricingRuntimeContext,
    });

    const saved = await this.snapshotRepo.save(snapshot);

    this.logger.log(`Pricing snapshot created for order: ${orderId}`);
    await this.eventBus.emit('pricing.snapshot.created', {
      orderId,
      snapshotId: saved.id,
      pricebookRevisionId: saved.pricebookRevisionId,
    });

    return saved;
  }

  /**
   * Get snapshot by order ID
   */
  async getSnapshotByOrderId(orderId: string): Promise<OrderPricingSnapshot> {
    const snapshot = await this.snapshotRepo.findOne({
      where: { orderId },
      relations: ['pricebookRevision', 'pricebookRevision.pricebook'],
    });
    if (!snapshot) {
      throw new NotFoundException({
        code: 'SNAPSHOT_NOT_FOUND',
        message: `Pricing snapshot for order '${orderId}' not found`,
      });
    }
    return snapshot;
  }

  /**
   * Lock a pricing snapshot (checkout boundary)
   */
  async lockSnapshot(orderId: string): Promise<OrderPricingSnapshot> {
    const snapshot = await this.getSnapshotByOrderId(orderId);

    if (snapshot.isLocked()) {
      throw new ConflictException({
        code: 'SNAPSHOT_ALREADY_LOCKED',
        message: `Pricing snapshot for order '${orderId}' is already locked`,
      });
    }

    snapshot.lockedAt = new Date();
    const saved = await this.snapshotRepo.save(snapshot);

    this.logger.log(`Pricing snapshot locked for order: ${orderId}`);
    await this.eventBus.emit('pricing.snapshot.locked', {
      orderId,
      snapshotId: saved.id,
      lockedAt: saved.lockedAt,
    });

    return saved;
  }

  /**
   * Check if order has a locked pricing snapshot
   */
  async isOrderLocked(orderId: string): Promise<boolean> {
    const snapshot = await this.snapshotRepo.findOne({
      where: { orderId },
      select: ['id', 'lockedAt'],
    });
    return !!snapshot?.lockedAt;
  }

  /**
   * Get the config snapshot for an order (via its pricing snapshot)
   */
  async getOrderConfigSnapshot(orderId: string): Promise<{
    configSnapshot: Record<string, unknown>;
    revision: PricebookRevision;
    snapshot: OrderPricingSnapshot;
  }> {
    const snapshot = await this.getSnapshotByOrderId(orderId);
    const revision = await this.revisionRepo.findOne({
      where: { id: snapshot.pricebookRevisionId },
      relations: ['pricebook', 'priceLists'],
    });

    if (!revision) {
      throw new NotFoundException({
        code: 'REVISION_NOT_FOUND',
        message: `Revision for snapshot not found`,
      });
    }

    return {
      configSnapshot: revision.configSnapshot,
      revision,
      snapshot,
    };
  }
}
