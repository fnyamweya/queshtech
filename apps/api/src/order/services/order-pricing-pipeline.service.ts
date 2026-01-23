import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { createHash } from 'crypto';

import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderShippingAddress } from '../entities/order-shipping-address.entity';
import { Batch, BatchItem } from '../batches/entities';

import {
  ChargeAllocation,
  ChargeComponent,
  OrderPricingSnapshot,
  PricingAppliedRule,
  PricingRun,
  PricebookRevision,
} from '../../pricing/entities';
import { PricebookRoutingService } from '../../pricing/pricebook-routing.service';
import { PricingSnapshotService } from '../../pricing/pricing-snapshot.service';
import { PromotionService } from '../../promotion/services/promotion.service';
import { TaxService } from './tax.service';
import { PriceService } from '../../catalog/services/price.service';
import { RepriceOrderDto } from '../dto/order-reprice.dto';
import { LockPricingDto } from '../dto/order-lock-pricing.dto';
import { ApplyPricingAdjustmentsDto } from '../dto/order-pricing-adjustments.dto';
import { ResolveBatchesDto } from '../dto/resolve-batches.dto';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${entries.join(',')}}`;
}

function sha256Hex(input: unknown): string {
  const payload = typeof input === 'string' ? input : stableStringify(input);
  return createHash('sha256').update(payload).digest('hex');
}

function sanitizeQuoteRuntimeContext(ctx: unknown): Record<string, unknown> {
  const obj = (ctx && typeof ctx === 'object' && !Array.isArray(ctx)) ? (ctx as Record<string, unknown>) : {};
  const { quoteFingerprint: _qf, quoteInputsVersion: _qv, ...rest } = obj as any;
  return rest as Record<string, unknown>;
}

function computeQuoteFingerprint(input: {
  orderId: string;
  currency: string;
  revisionId: string;
  shippingSubtotal: string;
  orderItems: Array<{ productSkuId: string | null; quantity: number }>;
  address: {
    countryCode: string | null;
    locationId: string | null;
    fields: Record<string, unknown>;
  } | null;
  runtimeContext: Record<string, unknown>;
}): string {
  return sha256Hex({
    orderId: input.orderId,
    currency: input.currency,
    revisionId: input.revisionId,
    orderItems: input.orderItems,
    shippingSubtotal: input.shippingSubtotal,
    address: input.address,
    runtimeContext: sanitizeQuoteRuntimeContext(input.runtimeContext),
  });
}

@Injectable()
export class OrderPricingPipelineService {
  private readonly logger = new Logger(OrderPricingPipelineService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly routingService: PricebookRoutingService,
    private readonly snapshotService: PricingSnapshotService,
    private readonly promotionService: PromotionService,
    private readonly taxService: TaxService,
    private readonly priceService: PriceService,
  ) {}

  async repriceDraftOrder(orderId: string, dto: RepriceOrderDto) {
    // Resolve order upfront for currency + status checks
    const orderRepo = this.dataSource.getRepository(Order);
    const order = await orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    // If pricing is locked, repricing is forbidden regardless of order status.
    // (Lock boundary must be immutable.)
    const existingSnapshot = await this.dataSource
      .getRepository(OrderPricingSnapshot)
      .findOne({ where: { orderId: order.id }, select: ['id', 'lockedAt'] as any });
    if (existingSnapshot?.lockedAt) {
      throw new ConflictException({
        code: 'SNAPSHOT_LOCKED',
        message: `Pricing snapshot for order '${orderId}' is locked and cannot be repriced`,
      });
    }

    const shippingAddress = await this.dataSource
      .getRepository(OrderShippingAddress)
      .findOne({ where: { orderId: order.id } });

    // Orders in terminal states (completed, cancelled) cannot be repriced
    const terminalStatuses = new Set(['completed', 'cancelled']);
    const normalizedStatus = (order.status || '').toLowerCase();
    if (terminalStatuses.has(normalizedStatus)) {
      throw new ConflictException({
        code: 'ORDER_TERMINAL_STATUS',
        message: `Order '${orderId}' is in '${order.status}' status and cannot be repriced`,
      });
    }

    const currency = (dto.currency ?? order.currencyCode).toUpperCase();

    // Resolve effective revision using routing rules
    const resolution = await this.routingService.resolvePricebook({
      currency,
      at: dto.at,
      channelId: dto.channelId,
      customerGroupId: dto.customerGroupId,
      countryCode: dto.countryCode ?? shippingAddress?.countryCode,
      salesChannelId: dto.salesChannelId,
      merchantId: dto.merchantId,
    });

    return this.dataSource.transaction(async (manager) => {
      const snapshot = await this.upsertSnapshotTx(manager, orderId, {
        currency,
        pricebookRevisionId: resolution.pricebookRevisionId,
        pricingEngineVersion: dto.pricingEngineVersion ?? 'pricing-engine@1.0.0',
        runtimeContext: dto.runtimeContext ?? {},
      });

      const { run, idempotencyKey } = await this.ensurePricingRunTx(
        manager,
        order,
        shippingAddress,
        snapshot,
        dto,
      );

      // Store quote fingerprint on the snapshot for stale-quote protection at checkout boundary.
      // IMPORTANT: this must match lockPricing() computation.
      const fingerprint = computeQuoteFingerprint({
        orderId: order.id,
        currency: snapshot.currencyCode,
        revisionId: snapshot.pricebookRevisionId,
        shippingSubtotal: String(order.shippingSubtotal ?? '0'),
        orderItems: (order.items ?? []).map((it) => ({
          productSkuId: it.productSkuId ?? null,
          quantity: it.quantity,
        })),
        address: shippingAddress
          ? {
              countryCode: shippingAddress.countryCode ?? null,
              locationId: shippingAddress.locationId ?? null,
              fields: (shippingAddress.fieldsJson ?? {}) as any,
            }
          : null,
        runtimeContext: (dto.runtimeContext ?? {}) as any,
      });

      const nextRuntimeContext: any = {
        ...(snapshot.runtimeContext ?? {}),
        quoteFingerprint: fingerprint,
        quoteInputsVersion: 1,
      };
      snapshot.runtimeContext = nextRuntimeContext;
      await manager.getRepository(OrderPricingSnapshot).save(snapshot);

      // If we already have a successful run for same idempotency key, return it
      if (run.status === 'SUCCEEDED') {
        return {
          snapshot,
          pricingRun: run,
          idempotencyKey,
          reused: true,
        };
      }

      try {
        // DRAFT CLEANUP: Delete previous pricing artifacts for this snapshot
        // (implements "draft = replace" semantics)
        await this.deletePreviousArtifactsTx(manager, snapshot.id, run.id);

        await this.runPricingTx(manager, order, snapshot, run, dto);

        // RECONCILIATION: Validate artifacts before marking run as succeeded
        await this.validateReconciliationTx(manager, order, snapshot, run);

        run.status = 'SUCCEEDED';
        run.finishedAt = new Date();
        await manager.getRepository(PricingRun).save(run);

        return {
          snapshot,
          pricingRun: run,
          idempotencyKey,
          reused: false,
        };
      } catch (err: any) {
        run.status = 'FAILED';
        run.finishedAt = new Date();
        run.error = {
          message: err?.message ?? 'pricing_failed',
          name: err?.name,
        };
        await manager.getRepository(PricingRun).save(run);

        throw err;
      }
    });
  }

  /**
   * Delete all artifacts from previous pricing runs for this snapshot.
   * Implements "draft = replace" semantics: every new pricing run replaces
   * all existing artifacts for that snapshot.
   */
  private async deletePreviousArtifactsTx(
    manager: EntityManager,
    snapshotId: string,
    currentRunId: string,
  ): Promise<void> {
    // Get all previous run IDs for this snapshot (excluding current)
    const previousRuns = await manager.getRepository(PricingRun).find({
      where: { snapshotId },
      select: ['id'],
    });

    const previousRunIds = previousRuns
      .map((r) => r.id)
      .filter((id) => id !== currentRunId);

    if (previousRunIds.length === 0) return;

    // Delete in order: allocations → charges → rules (respecting FK constraints)
    await manager.getRepository(ChargeAllocation).delete({
      snapshotId,
      pricingRunId: In(previousRunIds),
    });

    await manager.getRepository(ChargeComponent).delete({
      snapshotId,
      pricingRunId: In(previousRunIds),
    });

    await manager.getRepository(PricingAppliedRule).delete({
      snapshotId,
      pricingRunId: In(previousRunIds),
    });

    this.logger.debug(
      `Deleted artifacts from ${previousRunIds.length} previous runs for snapshot ${snapshotId}`,
    );
  }

  /**
   * Reconciliation invariants:
   * 1. Sum of discount allocations must equal the discount charge amount
   * 2. Sum of (BASE - discount allocation + TAX) per item must match expected
   * 3. Grand total must equal itemsSubtotal - discountTotal + shippingTotal + taxTotal
   */
  private async validateReconciliationTx(
    manager: EntityManager,
    order: Order,
    snapshot: OrderPricingSnapshot,
    run: PricingRun,
  ): Promise<void> {
    const charges = await manager.getRepository(ChargeComponent).find({
      where: { snapshotId: snapshot.id, pricingRunId: run.id },
    });

    const allocations = await manager.getRepository(ChargeAllocation).find({
      where: { snapshotId: snapshot.id, pricingRunId: run.id },
    });

    const TOLERANCE = 0.0001;

    // 1. Validate discount allocation sums
    const discountCharges = charges.filter((c) => c.chargeType === 'DISCOUNT' && c.scope === 'ORDER');
    for (const discountCharge of discountCharges) {
      // Skip shipping discount (no item allocations)
      const meta = discountCharge.metaJson as any;
      if (meta?.appliesToShipping) continue;

      const chargeAllocations = allocations.filter(
        (a) => a.chargeComponentId === discountCharge.id,
      );

      const allocSum = chargeAllocations.reduce(
        (sum, a) => sum + Number(a.amount || 0),
        0,
      );

      const chargeAmount = Number(discountCharge.amount || 0);

      if (Math.abs(allocSum - chargeAmount) > TOLERANCE) {
        throw new BadRequestException({
          code: 'RECONCILIATION_FAILED',
          message: `Discount allocation sum (${allocSum.toFixed(4)}) does not match charge amount (${chargeAmount.toFixed(4)})`,
          details: { chargeId: discountCharge.id, allocSum, chargeAmount },
        });
      }
    }

    // 2. Validate order totals consistency
    const refreshedOrder = await manager.getRepository(Order).findOne({
      where: { id: order.id },
    });

    if (!refreshedOrder) {
      throw new NotFoundException(`Order ${order.id} disappeared during pricing`);
    }

    const itemsSubtotal = Number(refreshedOrder.itemsSubtotal || 0);
    const discountTotal = Number(refreshedOrder.discountTotal || 0);
    const feeTotal = Number(refreshedOrder.feeTotal || 0);
    const shippingDiscount = Number(refreshedOrder.shippingDiscount || 0);
    const shippingTotal = Number(refreshedOrder.shippingTotal || 0);
    const taxTotal = Number(refreshedOrder.taxTotal || 0);
    const shippingTax = Number(refreshedOrder.shippingTax || 0);
    const grandTotal = Number(refreshedOrder.grandTotal || 0);

    // Expected: grandTotal = itemsSubtotal - discountTotal + shippingTotal + taxTotal + feeTotal
    // Note: shippingTotal already includes shippingTax, so we use:
    // grandTotal = itemsSubtotal - discountTotal + shippingTotal + taxTotal + feeTotal
    const expectedGrand = itemsSubtotal - discountTotal + shippingTotal + taxTotal + feeTotal;

    if (Math.abs(grandTotal - expectedGrand) > TOLERANCE) {
      throw new BadRequestException({
        code: 'RECONCILIATION_FAILED',
        message: `Grand total (${grandTotal.toFixed(4)}) does not match computed total (${expectedGrand.toFixed(4)})`,
        details: { itemsSubtotal, discountTotal, feeTotal, shippingDiscount, shippingTotal, taxTotal, shippingTax, grandTotal, expectedGrand },
      });
    }

    // 3. Validate charge totals match order fields
    const baseChargeSum = charges
      .filter((c) => c.chargeType === 'BASE' && c.scope === 'ITEM')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    if (Math.abs(baseChargeSum - itemsSubtotal) > TOLERANCE) {
      throw new BadRequestException({
        code: 'RECONCILIATION_FAILED',
        message: `Base charge sum (${baseChargeSum.toFixed(4)}) does not match itemsSubtotal (${itemsSubtotal.toFixed(4)})`,
      });
    }

    const discountChargeSum = charges
      .filter((c) => c.chargeType === 'DISCOUNT')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    // Discount amounts are negative, so we negate for comparison
    // Combined discount = discountTotal + shippingDiscount
    const totalDiscountExpected = discountTotal + shippingDiscount;
    if (Math.abs(-discountChargeSum - totalDiscountExpected) > TOLERANCE) {
      throw new BadRequestException({
        code: 'RECONCILIATION_FAILED',
        message: `Discount charge sum (${(-discountChargeSum).toFixed(4)}) does not match combined discounts (${totalDiscountExpected.toFixed(4)})`,
      });
    }

    this.logger.debug(`Reconciliation passed for order ${order.id}, run ${run.id}`);
  }

  async getCurrentPricing(orderId: string) {
    const snapshot = await this.snapshotService.getSnapshotByOrderId(orderId);

    const runRepo = this.dataSource.getRepository(PricingRun);
    const baseRun = await runRepo.findOne({
      where: { snapshotId: snapshot.id, status: 'SUCCEEDED', kind: 'STANDARD' },
      order: { createdAt: 'DESC' },
    });

    if (!baseRun) {
      return {
        snapshot,
        pricingRun: null,
        adjustmentRuns: [],
        charges: [],
        allocations: [],
        appliedRules: [],
      };
    }

    const allAdjustmentRuns = await runRepo.find({
      where: { snapshotId: snapshot.id, status: 'SUCCEEDED', kind: 'ADJUSTMENT' },
      order: { createdAt: 'ASC' },
    });

    const adjustmentRuns = allAdjustmentRuns.filter((r) => r.createdAt > baseRun.createdAt);
    const runIds = [baseRun.id, ...adjustmentRuns.map((r) => r.id)];

    const charges = await this.dataSource.getRepository(ChargeComponent).find({
      where: { snapshotId: snapshot.id, pricingRunId: In(runIds) },
      order: { createdAt: 'ASC' },
    });

    const allocations = await this.dataSource.getRepository(ChargeAllocation).find({
      where: { snapshotId: snapshot.id, pricingRunId: In(runIds) },
      order: { createdAt: 'ASC' },
    });

    const appliedRules = await this.dataSource.getRepository(PricingAppliedRule).find({
      where: { snapshotId: snapshot.id, pricingRunId: In(runIds) },
      order: { createdAt: 'ASC' },
    });

    return { snapshot, pricingRun: baseRun, adjustmentRuns, charges, allocations, appliedRules };
  }

  /**
   * Checkout boundary: lock pricing snapshot + set order status READY_FOR_PAYMENT.
   * Preconditions:
   * - order exists
   * - order.status in {PENDING, AWAITING_SHIPPING_QUOTE, READY_FOR_PAYMENT}
   * - snapshot exists and lockedAt is null
   * - latest pricing run is SUCCEEDED
   * - optional stale quote protection via snapshot.runtimeContext.quoteFingerprint
   */
  async lockPricing(orderId: string, _dto: LockPricingDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager
        .getRepository(Order)
        .createQueryBuilder('o')
        .where('o.id = :id', { id: orderId })
        .setLock('pessimistic_write')
        .getOne();

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: `Order '${orderId}' not found`,
        });
      }

      const allowedStatuses = new Set<string>([
        'draft',
        'pending',
        'awaiting_shipping_quote',
        'ready_for_payment',
      ]);

      if (!allowedStatuses.has(String(order.status))) {
        throw new ConflictException({
          code: 'INVALID_ORDER_STATUS',
          message: `Order '${orderId}' status '${order.status}' cannot lock pricing`,
          details: { allowed: Array.from(allowedStatuses), status: order.status },
        });
      }

      const snapshot = await manager
        .getRepository(OrderPricingSnapshot)
        .createQueryBuilder('s')
        .where('s.orderId = :orderId', { orderId: order.id })
        .setLock('pessimistic_write')
        .getOne();

      if (!snapshot) {
        throw new NotFoundException({
          code: 'SNAPSHOT_NOT_FOUND',
          message: `Pricing snapshot for order '${orderId}' not found`,
        });
      }

      if (snapshot.lockedAt) {
        throw new ConflictException({
          code: 'SNAPSHOT_ALREADY_LOCKED',
          message: `Pricing snapshot for order '${orderId}' is already locked`,
        });
      }

      const latestRun = await manager.getRepository(PricingRun).findOne({
        where: { snapshotId: snapshot.id },
        order: { createdAt: 'DESC' as any },
      });

      if (!latestRun || latestRun.status !== 'SUCCEEDED') {
        throw new ConflictException({
          code: 'PRICING_RUN_NOT_SUCCEEDED',
          message: `Order '${orderId}' cannot lock pricing until latest pricing run has SUCCEEDED`,
          details: { latestRunId: latestRun?.id ?? null, status: latestRun?.status ?? null },
        });
      }

      // Optional stale-quote protection: compare stored fingerprint to current canonical inputs.
      const storedFingerprint = (snapshot.runtimeContext as any)?.quoteFingerprint;
      if (storedFingerprint) {
        const shippingAddress = await manager
          .getRepository(OrderShippingAddress)
          .findOne({ where: { orderId: order.id } });

        const orderWithItems = await manager.getRepository(Order).findOne({
          where: { id: order.id },
          relations: ['items'],
        });

        const orderItems = (orderWithItems?.items ?? []).map((it) => ({
          productSkuId: it.productSkuId ?? null,
          quantity: it.quantity,
        }));

        const addr = shippingAddress
          ? {
              countryCode: shippingAddress.countryCode ?? null,
              locationId: shippingAddress.locationId ?? null,
              fields: shippingAddress.fieldsJson ?? {},
            }
          : null;

        const currentFingerprint = computeQuoteFingerprint({
          orderId: order.id,
          currency: snapshot.currencyCode,
          revisionId: snapshot.pricebookRevisionId,
          shippingSubtotal: String(order.shippingSubtotal ?? '0'),
          orderItems,
          address: addr,
          runtimeContext: (snapshot.runtimeContext ?? {}) as any,
        });

        if (String(storedFingerprint) !== String(currentFingerprint)) {
          throw new ConflictException({
            code: 'QUOTE_STALE_REPRICE_REQUIRED',
            message: `Order '${orderId}' quote is stale; reprice is required before locking`,
          });
        }
      }

      snapshot.lockedAt = new Date();
      await manager.getRepository(OrderPricingSnapshot).save(snapshot);

      order.status = 'ready_for_payment' as any;
      await manager.getRepository(Order).save(order);

      return {
        orderId: order.id,
        snapshot: {
          id: snapshot.id,
          pricebookRevisionId: snapshot.pricebookRevisionId,
          lockedAt: snapshot.lockedAt,
        },
        status: order.status,
      };
    });
  }

  /**
   * Append-only pricing adjustments after pricing lock.
   * Creates a pricing_run(kind=ADJUSTMENT) and appends charge_component rows.
   */
  async applyPricingAdjustments(orderId: string, dto: ApplyPricingAdjustmentsDto) {
    const normalizedAdjustments = (dto.adjustments ?? [])
      .map((a) => ({
        amount: Number(a.amount || 0),
        displayName: a.displayName ?? null,
        reason: a.reason ?? null,
        meta: (a.meta ?? {}) as Record<string, unknown>,
      }))
      .filter((a) => Number(a.amount) !== 0);

    if (normalizedAdjustments.length === 0) {
      throw new BadRequestException({
        code: 'NOOP_ADJUSTMENT',
        message: 'At least one non-zero adjustment is required',
      });
    }

    const adjustmentTotal = normalizedAdjustments.reduce((sum, a) => sum + a.amount, 0);

    return this.dataSource.transaction(async (manager) => {
      const order = await manager
        .getRepository(Order)
        .createQueryBuilder('o')
        .where('o.id = :id', { id: orderId })
        .setLock('pessimistic_write')
        .getOne();

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: `Order '${orderId}' not found`,
        });
      }

      const snapshot = await manager
        .getRepository(OrderPricingSnapshot)
        .createQueryBuilder('s')
        .where('s.orderId = :orderId', { orderId: order.id })
        .setLock('pessimistic_write')
        .getOne();

      if (!snapshot) {
        throw new NotFoundException({
          code: 'SNAPSHOT_NOT_FOUND',
          message: `Pricing snapshot for order '${orderId}' not found`,
        });
      }

      if (!snapshot.lockedAt) {
        throw new ConflictException({
          code: 'SNAPSHOT_NOT_LOCKED',
          message: `Order '${orderId}' must lock pricing before applying adjustments`,
        });
      }

      const baseRun = await manager.getRepository(PricingRun).findOne({
        where: { snapshotId: snapshot.id, status: 'SUCCEEDED', kind: 'STANDARD' },
        order: { createdAt: 'DESC' as any },
      });

      if (!baseRun) {
        throw new ConflictException({
          code: 'PRICING_NOT_COMPUTED',
          message: `Order '${orderId}' has no SUCCEEDED base pricing run`,
        });
      }

      const idempotencyKey = sha256Hex({
        orderId: order.id,
        snapshotId: snapshot.id,
        clientIdempotencyKey: dto.clientIdempotencyKey ?? null,
        adjustments: normalizedAdjustments,
      });

      const runRepo = manager.getRepository(PricingRun);
      const existing = await runRepo.findOne({ where: { orderId: order.id, idempotencyKey } });
      if (existing?.status === 'SUCCEEDED') {
        return { orderId: order.id, pricingRun: existing, reused: true };
      }

      if (existing && existing.status !== 'STARTED') {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSE_FAILED',
          message: 'Existing adjustment run has failed; use a new idempotency key to retry',
          details: { existingRunId: existing.id, status: existing.status },
        });
      }

      const run = existing
        ? existing
        : await runRepo.save(
            runRepo.create({
              orderId: order.id,
              snapshotId: snapshot.id,
              idempotencyKey,
              status: 'STARTED',
              kind: 'ADJUSTMENT',
              engineVersion: snapshot.pricingEngineVersion,
            }),
          );

      try {
        const chargeRepo = manager.getRepository(ChargeComponent);
        const ruleRepo = manager.getRepository(PricingAppliedRule);

        const charges = await chargeRepo.save(
          normalizedAdjustments.map((a) =>
            chargeRepo.create({
              orderId: order.id,
              snapshotId: snapshot.id,
              pricingRunId: run.id,
              scope: 'ORDER',
              chargeType: 'ADJUSTMENT',
              currencyCode: snapshot.currencyCode,
              displayName: a.displayName ?? 'Adjustment',
              amount: Number(a.amount).toFixed(4),
              metaJson: { reason: a.reason ?? 'manual_adjustment', ...(a.meta ?? {}) },
            }),
          ),
        );

        await ruleRepo.save(
          charges.map((c) =>
            ruleRepo.create({
              orderId: order.id,
              snapshotId: snapshot.id,
              pricingRunId: run.id,
              ruleType: 'ADJUSTMENT',
              ruleId: String((c.metaJson as any)?.reason ?? 'manual_adjustment'),
              decision: 'APPLIED',
              trace: {
                chargeComponentId: c.id,
                amount: c.amount,
                displayName: c.displayName,
              },
            }),
          ),
        );

        const nextFeeTotal = Number(order.feeTotal || 0) + adjustmentTotal;
        const nextGrandTotal = Number(order.grandTotal || 0) + adjustmentTotal;

        await manager.getRepository(Order).update(
          { id: order.id },
          {
            feeTotal: nextFeeTotal.toFixed(4) as any,
            grandTotal: nextGrandTotal.toFixed(4) as any,
          } as any,
        );

        run.status = 'SUCCEEDED';
        run.finishedAt = new Date();
        await runRepo.save(run);

        return {
          orderId: order.id,
          pricingRun: run,
          reused: false,
          delta: { feeTotal: adjustmentTotal.toFixed(4) },
          totals: {
            feeTotal: nextFeeTotal.toFixed(4),
            grandTotal: nextGrandTotal.toFixed(4),
          },
        };
      } catch (err: any) {
        run.status = 'FAILED';
        run.finishedAt = new Date();
        run.error = { message: err?.message ?? 'adjustment_failed', name: err?.name };
        await runRepo.save(run);
        throw err;
      }
    });
  }

  /**
   * Get batches for an order.
   */
  async getBatches(orderId: string) {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: `Order '${orderId}' not found`,
      });
    }

    const batches = await this.dataSource.getRepository(Batch).find({
      where: { orderId },
      relations: ['items'],
      order: { createdAt: 'ASC' },
    });

    return batches.map((b) => ({
      id: b.id,
      orderId: b.orderId,
      warehouseId: b.warehouseId,
      status: b.status,
      shippingAddressSnapshotJson: b.shippingAddressSnapshotJson,
      items: (b.items ?? []).map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        quantity: item.quantity,
      })),
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));
  }

  /**
   * Groundwork: resolve batches for an order and persist them.
   * Currently resolves a single batch containing all eligible items.
   */
  async resolveBatches(orderId: string, dto: ResolveBatchesDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(Order).findOne({
        where: { id: orderId },
        relations: ['items'],
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: `Order '${orderId}' not found`,
        });
      }

      const snapshot = await manager
        .getRepository(OrderPricingSnapshot)
        .createQueryBuilder('s')
        .where('s.orderId = :orderId', { orderId: order.id })
        .setLock('pessimistic_write')
        .getOne();

      if (!snapshot) {
        throw new NotFoundException({
          code: 'SNAPSHOT_NOT_FOUND',
          message: `Pricing snapshot for order '${orderId}' not found`,
        });
      }

      const shippingAddress = await manager
        .getRepository(OrderShippingAddress)
        .findOne({ where: { orderId: order.id } });

      const includeNonShippable = !!dto.includeNonShippable;
      const eligibleItems = (order.items ?? []).filter((it) =>
        includeNonShippable ? true : !!it.requiresShipping,
      );

      const batchRepo = manager.getRepository(Batch);
      const batchItemRepo = manager.getRepository(BatchItem);

      // Replace semantics: delete existing batches for this order and recreate.
      await batchRepo.delete({ orderId: order.id });

      if (eligibleItems.length === 0) {
        snapshot.runtimeContext = {
          ...(snapshot.runtimeContext ?? {}),
          warehouseGrouping:
            dto.warehouseGrouping ?? (snapshot.runtimeContext as any)?.warehouseGrouping ?? 'SINGLE',
          batches: [],
        } as any;
        await manager.getRepository(OrderPricingSnapshot).save(snapshot);
        return { orderId: order.id, batches: [] };
      }

      const addressSnapshot = shippingAddress
        ? {
            countryCode: shippingAddress.countryCode ?? null,
            locationId: shippingAddress.locationId ?? null,
            fields: shippingAddress.fieldsJson ?? {},
          }
        : {};

      const batch = await batchRepo.save(
        batchRepo.create({
          orderId: order.id,
          warehouseId: dto.warehouseId ?? null,
          shippingAddressSnapshotJson: addressSnapshot as any,
          status: 'resolved',
        }),
      );

      await batchItemRepo.save(
        eligibleItems.map((it) =>
          batchItemRepo.create({
            batchId: batch.id,
            orderItemId: it.id,
            quantity: it.quantity,
          }),
        ),
      );

      snapshot.runtimeContext = {
        ...(snapshot.runtimeContext ?? {}),
        warehouseGrouping:
          dto.warehouseGrouping ?? (snapshot.runtimeContext as any)?.warehouseGrouping ?? 'SINGLE',
        batches: [
          {
            id: batch.id,
            warehouseId: batch.warehouseId ?? undefined,
            itemIds: eligibleItems.map((it) => it.id),
          },
        ],
      } as any;

      await manager.getRepository(OrderPricingSnapshot).save(snapshot);

      return {
        orderId: order.id,
        batches: [
          {
            id: batch.id,
            warehouseId: batch.warehouseId ?? null,
            itemIds: eligibleItems.map((it) => it.id),
          },
        ],
      };
    });
  }

  private async upsertSnapshotTx(
    manager: EntityManager,
    orderId: string,
    dto: {
      currency: string;
      pricebookRevisionId: string;
      pricingEngineVersion: string;
      runtimeContext: Record<string, unknown>;
    },
  ): Promise<OrderPricingSnapshot> {
    // Validate revision exists and is published + effective (reuse existing rules)
    const revision = await manager.getRepository(PricebookRevision).findOne({
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

    const snapshotRepo = manager.getRepository(OrderPricingSnapshot);
    const existing = await snapshotRepo.findOne({ where: { orderId } });

    if (existing?.isLocked()) {
      throw new ConflictException({
        code: 'SNAPSHOT_LOCKED',
        message: `Pricing snapshot for order '${orderId}' is locked and cannot be modified`,
      });
    }

    if (existing) {
      existing.pricebookRevisionId = dto.pricebookRevisionId;
      existing.currencyCode = dto.currency.toUpperCase();
      existing.pricingEngineVersion = dto.pricingEngineVersion;
      existing.runtimeContext = dto.runtimeContext as any;
      return snapshotRepo.save(existing);
    }

    const snapshot = snapshotRepo.create({
      tenantId: '00000000-0000-0000-0000-000000000000',
      orderId,
      pricebookRevisionId: dto.pricebookRevisionId,
      currencyCode: dto.currency.toUpperCase(),
      pricingEngineVersion: dto.pricingEngineVersion,
      runtimeContext: dto.runtimeContext as any,
    });

    return snapshotRepo.save(snapshot);
  }

  private async ensurePricingRunTx(
    manager: EntityManager,
    order: Order,
    shippingAddress: OrderShippingAddress | null,
    snapshot: OrderPricingSnapshot,
    dto: RepriceOrderDto,
  ): Promise<{ run: PricingRun; idempotencyKey: string }> {
    const orderItems = (order.items ?? []).map((it) => ({
      id: it.id,
      productSkuId: it.productSkuId ?? null,
      sku: it.sku ?? null,
      quantity: it.quantity,
      requiresShipping: it.requiresShipping,
    }));

    const addr = shippingAddress ?? undefined;
    const address = addr
      ? {
          countryCode: addr.countryCode ?? null,
          locationId: addr.locationId ?? null,
          fields: addr.fieldsJson ?? {},
        }
      : null;

    const idempotencyKey = sha256Hex({
      orderId: order.id,
      currency: snapshot.currencyCode,
      revisionId: snapshot.pricebookRevisionId,
      orderItems,
      shippingSubtotal: order.shippingSubtotal,
      runtimeContext: dto.runtimeContext ?? {},
      address,
    });

    const runRepo = manager.getRepository(PricingRun);

    const existing = await runRepo.findOne({
      where: { orderId: order.id, idempotencyKey },
    });

    if (existing) return { run: existing, idempotencyKey };

    const run = runRepo.create({
      orderId: order.id,
      snapshotId: snapshot.id,
      idempotencyKey,
      status: 'STARTED',
      kind: 'STANDARD',
      engineVersion: snapshot.pricingEngineVersion,
    });

    const saved = await runRepo.save(run);
    return { run: saved, idempotencyKey };
  }

  private allocateProportionally(
    total: number,
    bases: number[],
    decimals = 4,
  ): number[] {
    const safeBases = bases.map((b) => Math.max(0, Number(b) || 0));
    const sum = safeBases.reduce((a, b) => a + b, 0);
    if (sum <= 0) return safeBases.map(() => 0);

    const factor = Math.pow(10, decimals);
    const raw = safeBases.map((b) => (total * b) / sum);
    const rounded = raw.map((x) => Math.round(x * factor) / factor);

    // Reconcile rounding drift by adjusting the first element.
    const drift = Math.round((total - rounded.reduce((a, b) => a + b, 0)) * factor) / factor;
    if (rounded.length) rounded[0] = Math.round((rounded[0] + drift) * factor) / factor;
    return rounded;
  }

  private async runPricingTx(
    manager: EntityManager,
    order: Order,
    snapshot: OrderPricingSnapshot,
    run: PricingRun,
    dto: RepriceOrderDto,
  ) {
    const chargeRepo = manager.getRepository(ChargeComponent);
    const allocRepo = manager.getRepository(ChargeAllocation);
    const ruleRepo = manager.getRepository(PricingAppliedRule);

    const currencyCode = snapshot.currencyCode;
    const items = (order.items ?? []) as OrderItem[];

    const resolvedItems = await Promise.all(
      items.map(async (it) => {
        const resolved = await this.priceService.resolveSkuPrice({
          productSkuId: it.productSkuId ?? undefined,
          priceListId: order.priceListId,
          currencyCode,
          quantity: it.quantity,
        });
        const unitPrice = Number(resolved.unitPrice || 0);
        const baseSubtotal = unitPrice * (it.quantity || 0);
        return { it, resolved, unitPrice, baseSubtotal };
      }),
    );
    const computedItemsSubtotal = resolvedItems.reduce(
      (sum, x) => sum + x.baseSubtotal,
      0,
    );

    // Step B: base item charges
    const baseCharges = resolvedItems.map(({ it, unitPrice, baseSubtotal }) =>
      chargeRepo.create({
        orderId: order.id,
        orderItemId: it.id,
        snapshotId: snapshot.id,
        pricingRunId: run.id,
        scope: 'ITEM',
        chargeType: 'BASE',
        currencyCode,
        displayName: 'Base Price',
        amount: Number(baseSubtotal || 0).toFixed(4),
        metaJson: {
          unitPrice: unitPrice.toFixed(4),
          quantity: it.quantity,
        },
      }),
    );

    await chargeRepo.save(baseCharges);

    await ruleRepo.save(
      baseCharges.map((c) =>
        ruleRepo.create({
          orderId: order.id,
          orderItemId: c.orderItemId,
          snapshotId: snapshot.id,
          pricingRunId: run.id,
          ruleType: 'PRICING',
          ruleId: 'BASE_PRICE',
          decision: 'APPLIED',
          trace: {
            chargeComponentId: c.id,
            amount: c.amount,
          },
        }),
      ),
    );

    // Step C: promotions (order + shipping)
    const promoResult = await this.promotionService.evaluatePromotions({
      subtotal: computedItemsSubtotal.toFixed(4),
      currencyCode,
      shippingFee: order.shippingSubtotal,
      customerId: order.customerId ?? undefined,
      items: items.map((it) => ({
        productSkuId: it.productSkuId ?? undefined,
        quantity: it.quantity,
      })),
    });

    const totalDiscount = Number(promoResult.totalDiscount || '0');
    const shippingDiscount = Number((promoResult as any).shippingDiscount || '0');

    let orderDiscountComponent: ChargeComponent | null = null;
    let itemDiscountAllocations: number[] = items.map(() => 0);

    if (totalDiscount > 0) {
      orderDiscountComponent = await chargeRepo.save(
        chargeRepo.create({
          orderId: order.id,
          snapshotId: snapshot.id,
          pricingRunId: run.id,
          scope: 'ORDER',
          chargeType: 'DISCOUNT',
          currencyCode,
          displayName: 'Promotion Discount',
          amount: (-totalDiscount).toFixed(4),
          metaJson: { applied: promoResult.applied ?? [] },
        }),
      );

      await ruleRepo.save(
        (promoResult.applied ?? []).map((a) =>
          ruleRepo.create({
            orderId: order.id,
            snapshotId: snapshot.id,
            pricingRunId: run.id,
            ruleType: 'PROMO',
            ruleId: a.promotionId,
            ruleVersion: undefined,
            decision: 'APPLIED',
            trace: { code: a.code, discount: a.discount },
          }),
        ),
      );

      // Step D: allocate order-level discount to items
      const itemBases = resolvedItems.map((x) => Number(x.baseSubtotal || 0));
      const allocations = this.allocateProportionally(totalDiscount, itemBases, 4);
      itemDiscountAllocations = allocations;

      const allocRows = allocations
        .map((amt, i) => ({ amt, item: items[i] }))
        .filter((x) => x.item && x.amt > 0)
        .map((x) =>
          allocRepo.create({
            orderId: order.id,
            orderItemId: x.item.id,
            snapshotId: snapshot.id,
            pricingRunId: run.id,
            chargeComponentId: orderDiscountComponent!.id,
            amount: (-x.amt).toFixed(4),
            metaJson: { basis: 'base_subtotal' },
          }),
        );

      if (allocRows.length) await allocRepo.save(allocRows);

      await ruleRepo.save(
        ruleRepo.create({
          orderId: order.id,
          snapshotId: snapshot.id,
          pricingRunId: run.id,
          ruleType: 'ALLOCATION',
          ruleId: 'DISCOUNT',
          decision: 'APPLIED',
          trace: {
            chargeComponentId: orderDiscountComponent.id,
            basis: 'base_subtotal',
          },
        }),
      );
    }

    if (shippingDiscount > 0) {
      await chargeRepo.save(
        chargeRepo.create({
          orderId: order.id,
          snapshotId: snapshot.id,
          pricingRunId: run.id,
          scope: 'ORDER',
          chargeType: 'DISCOUNT',
          currencyCode,
          displayName: 'Shipping Discount',
          amount: (-shippingDiscount).toFixed(4),
          metaJson: { appliesToShipping: true, applied: promoResult.applied ?? [] },
        }),
      );
    }

    // Shipping charge component (uses existing order.shippingSubtotal as input)
    await chargeRepo.save(
      chargeRepo.create({
        orderId: order.id,
        snapshotId: snapshot.id,
        pricingRunId: run.id,
        scope: 'ORDER',
        chargeType: 'SHIPPING',
        currencyCode,
        displayName: 'Shipping',
        amount: Number(order.shippingSubtotal || '0').toFixed(4),
        metaJson: { source: 'order.shippingSubtotal' },
      }),
    );

    // Step E: tax
    const shippingNet = Math.max(0, Number(order.shippingSubtotal || '0') - shippingDiscount);
    const taxable = Number(computedItemsSubtotal || 0) - totalDiscount + shippingNet;
    const taxResult = await this.taxService.calculateTax({ taxableAmount: taxable, currencyCode });
    const taxAmount = Number(taxResult.amount || 0);

    const itemTaxableBases = resolvedItems.map((x, i) => {
      const base = Number(x.baseSubtotal || 0);
      const disc = totalDiscount > 0 ? Number(itemDiscountAllocations[i] ?? 0) : 0;
      return Math.max(0, base - disc);
    });

    const basesWithShipping = [...itemTaxableBases, shippingNet];
    const taxAllocations = this.allocateProportionally(taxAmount, basesWithShipping, 4);

    const itemTaxCharges = items
      .map((it, idx) => ({ it, amt: taxAllocations[idx] ?? 0 }))
      .filter((x) => x.amt > 0)
      .map((x) =>
        chargeRepo.create({
          orderId: order.id,
          orderItemId: x.it.id,
          snapshotId: snapshot.id,
          pricingRunId: run.id,
          scope: 'ITEM',
          chargeType: 'TAX',
          currencyCode,
          displayName: 'Tax',
          amount: Number(x.amt).toFixed(4),
          metaJson: { rate: taxResult.rate ?? 0 },
        }),
      );

    if (itemTaxCharges.length) {
      await chargeRepo.save(itemTaxCharges);
      await ruleRepo.save(
        itemTaxCharges.map((c) =>
          ruleRepo.create({
            orderId: order.id,
            orderItemId: c.orderItemId,
            snapshotId: snapshot.id,
            pricingRunId: run.id,
            ruleType: 'TAX',
            ruleId: 'DEFAULT_TAX',
            decision: 'APPLIED',
            trace: { amount: c.amount, rate: taxResult.rate ?? 0 },
          }),
        ),
      );
    }

    const shippingTax = taxAllocations[items.length] ?? 0;
    if (shippingTax > 0) {
      await chargeRepo.save(
        chargeRepo.create({
          orderId: order.id,
          snapshotId: snapshot.id,
          pricingRunId: run.id,
          scope: 'ORDER',
          chargeType: 'TAX',
          currencyCode,
          displayName: 'Shipping Tax',
          amount: Number(shippingTax).toFixed(4),
          metaJson: { rate: taxResult.rate ?? 0, appliesToShipping: true },
        }),
      );
    }

    // Step G: rollup cache on order (draft only)
    const itemsSubtotal = Number(computedItemsSubtotal || 0);
    const feeTotal = 0;
    const grandTotal = itemsSubtotal - totalDiscount + shippingNet + taxAmount + feeTotal;

    await manager.getRepository(Order).update(
      { id: order.id },
      {
        itemsSubtotal: itemsSubtotal.toFixed(4) as any,
        discountTotal: totalDiscount.toFixed(4) as any,
        feeTotal: Number(feeTotal).toFixed(4) as any,
        shippingDiscount: shippingDiscount.toFixed(4) as any,
        taxTotal: (taxAmount - shippingTax).toFixed(4) as any,
        shippingTax: Number(shippingTax).toFixed(4) as any,
        shippingTotal: (shippingNet + shippingTax).toFixed(4) as any,
        grandTotal: grandTotal.toFixed(4) as any,
      } as any,
    );

    this.logger.log(
      `Pricing run ${run.id} succeeded for order ${order.id} snapshot ${snapshot.id}`,
    );
  }
}
