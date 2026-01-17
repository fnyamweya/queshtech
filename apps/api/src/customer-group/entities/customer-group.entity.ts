import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CustomerGroupStatus = 'active' | 'inactive' | 'archived';
export type CustomerGroupType =
  | 'retail'
  | 'member'
  | 'wholesale'
  | 'vip'
  | 'employee'
  | 'partner'
  | 'b2b_contract';

@Entity('customer_group')
@Index('uq_customer_group_code', ['code'], { unique: true })
@Index('idx_customer_group_status_priority', ['status', 'priority'])
export class CustomerGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Human-friendly stable key like "RETAIL", "WHOLESALE", "VIP_GOLD" */
  @Column({ type: 'text' })
  code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'group_type', type: 'text', default: 'retail' })
  groupType: CustomerGroupType;

  @Column({ type: 'text', default: 'active' })
  status: CustomerGroupStatus;

  /**
   * Higher wins during "best match" selection.
   * e.g. b2b_contract 100 > vip 80 > member 50 > retail 0
   */
  @Column({ type: 'int', default: 0 })
  priority: number;

  /**
   * Whether multiple groups can apply simultaneously.
   * Typical: one pricing group at a time, but allow stacking promotions elsewhere.
   */
  @Column({ name: 'is_stackable', type: 'boolean', default: false })
  isStackable: boolean;

  /**
   * Optional constraints for the group’s applicability window
   * (e.g., a seasonal membership).
   */
  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true })
  validFrom?: Date;

  @Column({ name: 'valid_to', type: 'timestamptz', nullable: true })
  validTo?: Date;

  /**
   * Feature gates and purchase policy switches used by UI + API.
   * Keep this flexible as you evolve capabilities.
   */
  @Column({
    name: 'features_json',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  featuresJson: CustomerGroupFeatures;

  /**
   * Eligibility rules (optional).
   * If empty, membership is explicit (via mapping table).
   * If present, membership can be computed (rule engine).
   */
  @Column({
    name: 'eligibility_rules_json',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  eligibilityRulesJson: CustomerGroupRule[];

  /**
   * If you want group-level price modifiers as a fallback:
   * e.g. "10% off everything" for employees.
   * (Explicit SKU pricing should still override.)
   */
  @Column({
    name: 'price_policy_json',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  pricePolicyJson: CustomerGroupPricePolicy;

  @Column({ name: 'meta_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  metaJson: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/** ---- JSON types (keep in a separate file in real code) ---- */

export type CustomerGroupFeatures = {
  purchase?: {
    allowBackorder?: boolean;
    allowPreorder?: boolean;
    allowQuote?: boolean;
    allowSubscription?: boolean;
    minOrderAmount?: string; // numeric string
    maxOrderAmount?: string;
    minQtyPerItem?: number;
    maxQtyPerItem?: number;
  };
  ui?: {
    showSavings?: boolean;
    showCompareAt?: boolean;
    showUnitPrice?: boolean;
    showTierTable?: boolean;
    showStockHint?: boolean;
  };
  fulfillment?: {
    freeDeliveryEligible?: boolean;
    freeDeliveryThreshold?: string;
    preferredCarriers?: string[];
  };
};

export type CustomerGroupRule =
  | {
      type: 'tag';
      operator: 'in' | 'not_in';
      values: string[];
    }
  | {
      type: 'country';
      operator: 'in' | 'not_in';
      values: string[]; // "KE", "UG"
    }
  | {
      type: 'kyc_level';
      operator: 'gte' | 'eq';
      value: number;
    }
  | {
      type: 'email_domain';
      operator: 'in';
      values: string[]; // ["company.com"]
    }
  | {
      type: 'org_id';
      operator: 'in';
      values: string[];
    };

export type CustomerGroupPricePolicy = {
  /** Fallback price modifier if no explicit SKU price row matches */
  fallbackModifier?: {
    type: 'discount' | 'surcharge';
    unit: 'percentage' | 'fixed';
    amount: string; // numeric string
  };
  /** If true, explicit SKU pricing is required (no modifiers). */
  requireExplicitPricing?: boolean;
};
