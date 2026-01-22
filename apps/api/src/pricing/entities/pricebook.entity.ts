import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import { CustomerGroup } from '../../customer-group/entities/customer-group.entity';
import { SalesChannel } from '../../catalog/entities/sales-channel.entity';
import { PricebookRevision } from './pricebook-revision.entity';
import { PricebookAssignment } from './pricebook-assignment.entity';

/**
 * Pricebook: A named pricing regime (e.g., DEFAULT, RETAIL_KE, WHOLESALE_KE).
 * Contains configuration for how pricing is computed, including tax, shipping,
 * promotions, and allocation rules.
 */
@Entity('pricebook')
@Index('uq_pricebook_tenant_code', ['tenantId', 'code'], { unique: true })
@Index('idx_pricebook_active', ['isActive'])
export class Pricebook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'tenant_id',
    type: 'uuid',
    default: '00000000-0000-0000-0000-000000000000',
  })
  tenantId: string;

  @Column({ type: 'text' })
  code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => PricebookRevision, (rev) => rev.pricebook)
  revisions: PricebookRevision[];

  @OneToMany(() => PricebookAssignment, (assignment) => assignment.pricebook)
  assignments: PricebookAssignment[];

  @ManyToMany(() => Channel, { cascade: false })
  @JoinTable({
    name: 'pricebook_channel',
    joinColumn: { name: 'pricebook_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'channel_id', referencedColumnName: 'id' },
  })
  channels: Channel[];

  @ManyToMany(() => CustomerGroup, { cascade: false })
  @JoinTable({
    name: 'pricebook_customer_group',
    joinColumn: { name: 'pricebook_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'customer_group_id', referencedColumnName: 'id' },
  })
  customerGroups: CustomerGroup[];

  @ManyToMany(() => SalesChannel, { cascade: false })
  @JoinTable({
    name: 'pricebook_sales_channel',
    joinColumn: { name: 'pricebook_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'sales_channel_id', referencedColumnName: 'id' },
  })
  salesChannels: SalesChannel[];
}
