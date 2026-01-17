import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CustomerGroup } from './customer-group.entity';

export type EntitlementKey =
  | 'PURCHASE_QUOTE'
  | 'PURCHASE_SUBSCRIBE'
  | 'ALLOW_BACKORDER'
  | 'FREE_DELIVERY'
  | 'SHOW_UNIT_PRICE'
  | 'SHOW_TIER_TABLE';

@Entity('customer_group_entitlement')
@Index('uq_group_entitlement', ['groupId', 'key'], { unique: true })
export class CustomerGroupEntitlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => CustomerGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: CustomerGroup;

  @Column({ type: 'text' })
  key: EntitlementKey;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled: boolean;

  /**
   * Optional parameters (e.g. thresholds, limits)
   * Example: { threshold: "5000.00" }
   */
  @Column({
    name: 'params_json',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  paramsJson: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
