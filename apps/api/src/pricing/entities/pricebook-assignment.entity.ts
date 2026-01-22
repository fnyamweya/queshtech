import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Pricebook } from './pricebook.entity';
import { Channel } from '../../channels/entities/channel.entity';
import { CustomerGroup } from '../../customer-group/entities/customer-group.entity';
import { SalesChannel } from '../../catalog/entities/sales-channel.entity';

/**
 * PricebookAssignment: Routes an order context to a pricebook.
 * Uses priority-based routing with specificity scoring.
 *
 * Single-channel posture: Exactly one active default assignment (all routing dims NULL).
 * Multi-channel ready: Populate channel, customer_group, country, etc. for routing.
 */
@Entity('pricebook_assignment')
@Index('idx_pba_active_priority', ['tenantId', 'isActive', 'priority'])
export class PricebookAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'tenant_id',
    type: 'uuid',
    default: '00000000-0000-0000-0000-000000000000',
  })
  tenantId: string;

  @Column({ name: 'pricebook_id', type: 'uuid' })
  pricebookId: string;

  @ManyToOne(() => Pricebook, (pb) => pb.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pricebook_id' })
  pricebook: Pricebook;

  // Routing dimensions (all nullable for wildcard matching)
  @Column({ name: 'channel_id', type: 'uuid', nullable: true })
  channelId?: string;

  @ManyToOne(() => Channel, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'channel_id' })
  channel?: Channel;

  @Column({ name: 'customer_group_id', type: 'uuid', nullable: true })
  customerGroupId?: string;

  @ManyToOne(() => CustomerGroup, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'customer_group_id' })
  customerGroup?: CustomerGroup;

  @Column({ name: 'country_code', type: 'char', length: 2, nullable: true })
  countryCode?: string;

  @Column({ name: 'sales_channel_id', type: 'uuid', nullable: true })
  salesChannelId?: string;

  @ManyToOne(() => SalesChannel, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sales_channel_id' })
  salesChannel?: SalesChannel;

  @Column({ name: 'merchant_id', type: 'uuid', nullable: true })
  merchantId?: string;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'conditions_json',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  conditionsJson: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /**
   * Compute specificity score for routing.
   * Higher score = more specific match.
   */
  computeSpecificityScore(): number {
    let score = 0;
    if (this.channelId) score += 1;
    if (this.customerGroupId) score += 2;
    if (this.countryCode) score += 1;
    if (this.salesChannelId) score += 1;
    if (this.merchantId) score += 4;
    return score;
  }
}
