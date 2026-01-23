import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('order_item')
@Index('idx_order_item_order_id', ['orderId'])
@Index('idx_order_item_product_sku_id', ['productSkuId'])
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'product_sku_id', type: 'uuid' })
  productSkuId: string;

  @Column({ type: 'text', nullable: true })
  sku?: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'requires_shipping', type: 'boolean', default: true })
  requiresShipping: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

}
