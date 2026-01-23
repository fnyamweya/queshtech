import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderItem } from '../../entities/order-item.entity';
import { Batch } from './batch.entity';

@Entity('delivery_group_item') // Keep table name for backward compatibility
@Index('idx_dg_item_group', ['batchId'])
@Index('uq_dg_item_group_order_item', ['batchId', 'orderItemId'], {
  unique: true,
})
export class BatchItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'delivery_group_id', type: 'uuid' })
  batchId: string;

  @ManyToOne(() => Batch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delivery_group_id' })
  batch: Batch;

  @Column({ name: 'order_item_id', type: 'uuid' })
  orderItemId: string;

  @ManyToOne(() => OrderItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @Column({ type: 'int' })
  quantity: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
