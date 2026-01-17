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

export type MemberType = 'customer' | 'org';

@Entity('customer_group_member')
@Index('uq_group_member_unique', ['groupId', 'memberType', 'memberId'], {
  unique: true,
})
@Index('idx_group_member_lookup', ['memberType', 'memberId'])
export class CustomerGroupMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => CustomerGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: CustomerGroup;

  @Column({ name: 'member_type', type: 'text' })
  memberType: MemberType;

  /**
   * memberId references your Customer or Organization table.
   * Keep it as uuid string, join in service layer.
   */
  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true })
  validFrom?: Date;

  @Column({ name: 'valid_to', type: 'timestamptz', nullable: true })
  validTo?: Date;

  @Column({ name: 'meta_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  metaJson: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
