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
import { Product } from './product.entity';
import { ProductSku } from './product-sku.entity';

@Entity('product_image')
@Index('idx_product_image_product', ['productId'])
@Index('idx_product_image_sku', ['skuId'])
@Index('idx_product_image_primary', ['productId', 'isPrimary'])
export class ProductImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'sku_id', type: 'uuid', nullable: true })
  skuId?: string | null;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text', nullable: true })
  alt?: string | null;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Product, (product) => product.productImages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => ProductSku, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sku_id' })
  sku?: ProductSku;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
