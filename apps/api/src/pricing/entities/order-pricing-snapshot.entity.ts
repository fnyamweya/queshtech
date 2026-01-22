import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { PricebookRevision } from './pricebook-revision.entity';

/**
 * Runtime context stored with the pricing snapshot.
 * Contains facts used during pricing computation.
 */
export interface PricingRuntimeContext {
  warehouseGrouping?: string;
  carrierQuotes?: Record<string, string>;
  deliveryGroups?: Array<{
    id: string;
    warehouseId?: string;
    itemIds: string[];
  }>;
  appliedPromotions?: Array<{
    id: string;
    code?: string;
    discount: number;
  }>;
  fxRate?: number;
  fxBaseCurrency?: string;
  [key: string]: unknown;
}

/**
 * OrderPricingSnapshot: Binds an order to a specific pricebook revision.
 * Becomes locked at checkout to ensure pricing immutability.
 */
@Entity('order_pricing_snapshot')
@Index('uq_ops_order', ['orderId'], { unique: true })
@Index('idx_ops_revision', ['pricebookRevisionId'])
@Index('idx_ops_locked', ['lockedAt'])
export class OrderPricingSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'tenant_id',
    type: 'uuid',
    default: '00000000-0000-0000-0000-000000000000',
  })
  tenantId: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'pricebook_revision_id', type: 'uuid' })
  pricebookRevisionId: string;

  @ManyToOne(() => PricebookRevision, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pricebook_revision_id' })
  pricebookRevision: PricebookRevision;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode: string;

  @Column({ name: 'pricing_engine_version', type: 'text', default: '1.0.0' })
  pricingEngineVersion: string;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt?: Date;

  @Column({
    name: 'runtime_context',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  runtimeContext: PricingRuntimeContext;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /**
   * Check if the snapshot is locked (checkout boundary passed).
   */
  isLocked(): boolean {
    return !!this.lockedAt;
  }
}
