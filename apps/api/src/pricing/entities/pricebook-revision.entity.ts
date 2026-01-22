import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Pricebook } from './pricebook.entity';
import { PriceList } from '../../catalog/entities/price-list.entity';

export type PricebookRevisionStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';

/**
 * Config snapshot schema for pricebook revision.
 * This is the "pricing constitution" that governs how an order is priced.
 */
export interface PricebookConfigSnapshot {
  version: string;
  currency: string;

  catalogPricing?: {
    priceListRef?: { id: string; code?: string; version?: string };
    fallbackStrategy?: 'LAST_KNOWN_PRICE' | 'ERROR';
  };

  promotions?: {
    promoSetRef?: { id: string; version?: string };
    stacking?: {
      maxCoupons?: number;
      allowAutoPromosWithCoupon?: boolean;
      exclusiveGroups?: string[];
    };
  };

  tax?: {
    profileRef?: { id: string; version?: string };
    mode: 'INCLUSIVE' | 'EXCLUSIVE';
    vatRate: number;
    rounding?: 'HALF_UP' | 'HALF_DOWN' | 'FLOOR' | 'CEIL';
    shippingIsTaxable?: boolean;
  };

  shipping?: {
    profileRef?: { id: string; version?: string };
    grouping?: 'BY_WAREHOUSE' | 'BY_VENDOR' | 'SINGLE';
    ratingStrategy?: 'CARRIER_QUOTE' | 'TABLE_RATE' | 'FLAT_RATE';
    fallbackStrategy?: 'TABLE_RATE' | 'FLAT_RATE' | 'ERROR';
    freeShippingThresholdMinor?: number;
  };

  fees?: {
    profileRef?: { id: string; version?: string };
  };

  allocation?: {
    rules?: {
      DISCOUNT?: { basis: 'PROPORTIONAL_VALUE' | 'PROPORTIONAL_QTY' | 'EQUAL' };
      SHIPPING?: { basis: 'WEIGHT' | 'VALUE' | 'EQUAL'; fallback?: 'VALUE' | 'EQUAL' };
      HANDLING?: { basis: 'PROPORTIONAL_QTY' | 'EQUAL' };
    };
    residual?: { strategy: 'ASSIGN_TO_HIGHEST_VALUE_ITEM' | 'ASSIGN_TO_FIRST_ITEM' | 'SPREAD' };
  };

  [key: string]: unknown;
}

/**
 * PricebookRevision: An immutable version of a pricebook with effective dates.
 * Contains the config_snapshot that defines pricing behavior.
 */
@Entity('pricebook_revision')
@Index('uq_pbr_pricebook_revnum', ['pricebookId', 'revisionNumber'], { unique: true })
@Index('idx_pbr_effective_lookup', ['pricebookId', 'status', 'currencyCode', 'effectiveFrom', 'effectiveTo'])
export class PricebookRevision {
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

  @ManyToOne(() => Pricebook, (pb) => pb.revisions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pricebook_id' })
  pricebook: Pricebook;

  @Column({ name: 'revision_number', type: 'int' })
  revisionNumber: number;

  @Column({ type: 'text', default: 'DRAFT' })
  status: PricebookRevisionStatus;

  @Column({ name: 'effective_from', type: 'timestamptz', nullable: true })
  effectiveFrom?: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo?: Date;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode: string;

  @Column({
    name: 'config_snapshot',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  configSnapshot: PricebookConfigSnapshot;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Many-to-many: revision can reference multiple price lists
  @ManyToMany(() => PriceList, { cascade: false })
  @JoinTable({
    name: 'pricebook_revision_price_list',
    joinColumn: { name: 'pricebook_revision_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'price_list_id', referencedColumnName: 'id' },
  })
  priceLists: PriceList[];
}
