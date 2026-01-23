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
import { OrderPricingSnapshot } from './order-pricing-snapshot.entity';

export type PricingRunStatus = 'STARTED' | 'SUCCEEDED' | 'FAILED';
export type PricingRunKind = 'STANDARD' | 'ADJUSTMENT';

@Entity('pricing_run')
@Index('uq_pricing_run_order_idempotency', ['orderId', 'idempotencyKey'], {
  unique: true,
})
@Index('idx_pricing_run_snapshot', ['snapshotId', 'status', 'createdAt'])
export class PricingRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'snapshot_id', type: 'uuid' })
  snapshotId: string;

  @ManyToOne(() => OrderPricingSnapshot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'snapshot_id' })
  snapshot: OrderPricingSnapshot;

  @Column({ name: 'idempotency_key', type: 'text' })
  idempotencyKey: string;

  @Column({ type: 'text', default: 'STARTED' })
  status: PricingRunStatus;

  @Column({ type: 'text', default: 'STANDARD' })
  kind: PricingRunKind;

  @Column({ name: 'engine_version', type: 'text' })
  engineVersion: string;

  @Column({ type: 'jsonb', nullable: true })
  error?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt?: Date;
}
