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
import { ChargeComponent } from './charge-component.entity';

@Entity('charge_allocation')
@Index('idx_charge_allocation_component', ['chargeComponentId'])
@Index('idx_charge_allocation_snapshot_run', ['snapshotId', 'pricingRunId'])
export class ChargeAllocation {
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

  @Column({ name: 'charge_component_id', type: 'uuid' })
  chargeComponentId: string;

  @ManyToOne(() => ChargeComponent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'charge_component_id' })
  chargeComponent: ChargeComponent;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  amount: string;

  @Column({ name: 'meta_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  metaJson: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
