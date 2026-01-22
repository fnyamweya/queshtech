import {
  AppliedOverrideInfo,
  AttributeValue,
  ContextualOverrideDTO,
  ID,
  LocalizedString,
  LocalizedText,
  ProductStatus,
  ProductType,
} from './product.types';
import { PublicBrandDto } from '../public/public-brand.dto';
import { PublicCategoryDto } from '../public/public-category.dto';

export interface ProductDTO {
  // --------------------------------------------------
  // 1. Core Identity
  // --------------------------------------------------
  id: string;
  code: string;
  slug?: string;
  type: ProductType;

  // --------------------------------------------------
  // 2. Classification & Taxonomy
  // --------------------------------------------------
  categories: PublicCategoryDto[];
  tags?: string[];
  collections?: string[];
  brand?: PublicBrandDto;

  // --------------------------------------------------
  // 3. Human-Facing Metadata
  // --------------------------------------------------
  name: LocalizedString;
  description?: LocalizedString;
  shortDescription?: LocalizedString;

  // --------------------------------------------------
  // 3b. Option Definitions (for SKU variations)
  // --------------------------------------------------
  optionDefinitions?: Array<{
    key: string;
    label?: string;
    allowedValues?: string[];
    required?: boolean;
  }>;

  // --------------------------------------------------
  // 4. Dynamic Attributes (Schema-Driven)
  // --------------------------------------------------
  attributes: Record<string, AttributeValue>;
  attributeSchemaRef: {
    schemaId: string;
    schemaVersion: number;
  };

  // --------------------------------------------------
  // 5. Commercial Model
  // --------------------------------------------------
  taxation?: Record<string, unknown>;
  discounts?: Array<Record<string, unknown>>;

  // --------------------------------------------------
  // 6. Availability & Lifecycle
  // --------------------------------------------------
  status: ProductStatus;

  // --------------------------------------------------
  // 7. Media
  // --------------------------------------------------
  images?: Array<{
    id: ID;
    url: string;
    alt?: string;
    skuId?: ID;
    isPrimary?: boolean;
    sortOrder?: number;
  }>;

  // --------------------------------------------------
  // 9. Contextual Overrides
  // --------------------------------------------------
  overrides?: ContextualOverrideDTO[];

  skus?: Array<{
    id: ID;
    code: string;
    name?: LocalizedText;
    attributes?: Record<string, unknown>;
    options?: Record<string, string>;
    availability?: Record<string, unknown>;
    isDefault?: boolean;
    prices?: Array<{
      priceListId: ID;
      currencyCode: string;
      unitPrice: string;
      compareAtPrice?: string;
    }>;
  }>;

  prices?: Array<{
    priceListId: ID;
    currencyCode: string;
    unitPrice: string;
    compareAtPrice?: string;
  }>;
}

export interface ProductViewDTO extends ProductDTO {
  appliedOverrides: AppliedOverrideInfo[];
}
