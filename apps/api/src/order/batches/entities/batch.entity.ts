import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../entities/order.entity';
import { BatchItem } from './batch-item.entity';

@Entity('delivery_group') // Keep table name for backward compatibility
@Index('idx_delivery_group_order', ['orderId'])
@Index('idx_delivery_group_warehouse', ['warehouseId'])
export class Batch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'warehouse_id', type: 'uuid', nullable: true })
  warehouseId?: string | null;

  @Column({
    name: 'shipping_address_snapshot_json',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  shippingAddressSnapshotJson: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  status?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => BatchItem, (it) => it.batch)
  items: BatchItem[];
}
