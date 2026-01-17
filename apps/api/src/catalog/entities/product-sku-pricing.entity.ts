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
import { PriceList } from './price-list.entity';
import { ProductSku } from './product-sku.entity';

@Entity('product_sku_pricing')
@Index('idx_sku_pricing_lookup', [
  'priceListId',
  'productSkuId',
  'minQuantity',
])
export class ProductSkuPricing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_sku_id', type: 'uuid' })
  productSkuId: string;

  @ManyToOne(() => ProductSku, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_sku_id' })
  productSku: ProductSku;

  @Column({ name: 'price_list_id', type: 'uuid' })
  priceListId: string;

  @ManyToOne(() => PriceList, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'price_list_id' })
  priceList: PriceList;

  @Column({ name: 'selector_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  selectorJson: Record<string, unknown>;

  @Column({ name: 'currency_code', type: 'char', length: 3, nullable: true })
  currencyCode?: string;

  @Column({ name: 'unit_amount', type: 'bigint' })
  unitAmount: string;

  @Column({ name: 'compare_at_amount', type: 'bigint', nullable: true })
  compareAtAmount?: string;

  @Column({ name: 'min_quantity', type: 'int', default: 1 })
  minQuantity: number;

  @Column({ name: 'max_quantity', type: 'int', nullable: true })
  maxQuantity?: number;

  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true })
  validFrom?: Date;

  @Column({ name: 'valid_to', type: 'timestamptz', nullable: true })
  validTo?: Date;

  @Column({ name: 'meta_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  metaJson: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}