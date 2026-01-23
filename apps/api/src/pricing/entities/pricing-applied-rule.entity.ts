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
import { OrderItem } from '../../order/entities/order-item.entity';
import { OrderPricingSnapshot } from './order-pricing-snapshot.entity';
import { PricingRun } from './pricing-run.entity';

export type AppliedRuleDecision = 'APPLIED' | 'SKIPPED' | 'REJECTED';

@Entity('pricing_applied_rule')
@Index('idx_pricing_rule_snapshot_run', ['snapshotId', 'pricingRunId'])
@Index('idx_pricing_rule_order', ['orderId', 'createdAt'])
export class PricingAppliedRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_item_id', type: 'uuid', nullable: true })
  orderItemId?: string;

  @ManyToOne(() => OrderItem, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem?: OrderItem;

  @Column({ name: 'snapshot_id', type: 'uuid' })
  snapshotId: string;

  @ManyToOne(() => OrderPricingSnapshot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'snapshot_id' })
  snapshot: OrderPricingSnapshot;

  @Column({ name: 'pricing_run_id', type: 'uuid' })
  pricingRunId: string;

  @ManyToOne(() => PricingRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pricing_run_id' })
  pricingRun: PricingRun;

  @Column({ name: 'rule_type', type: 'text' })
  ruleType: string;

  @Column({ name: 'rule_id', type: 'text', nullable: true })
  ruleId?: string;

  @Column({ name: 'rule_version', type: 'text', nullable: true })
  ruleVersion?: string;

  @Column({ type: 'text' })
  decision: AppliedRuleDecision;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  trace: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
