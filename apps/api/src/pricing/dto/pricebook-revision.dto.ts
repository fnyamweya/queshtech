import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Config snapshot tax configuration
 */
export class TaxConfigDto {
  @ApiPropertyOptional({ description: 'Tax profile reference ID' })
  @IsOptional()
  @IsString()
  profileRefId?: string;

  @ApiProperty({ description: 'Tax mode', enum: ['INCLUSIVE', 'EXCLUSIVE'] })
  @IsString()
  mode: 'INCLUSIVE' | 'EXCLUSIVE';

  @ApiProperty({ description: 'VAT rate (0-1)', example: 0.16 })
  @IsNumber()
  @Min(0)
  vatRate: number;

  @ApiPropertyOptional({ description: 'Rounding strategy', enum: ['HALF_UP', 'HALF_DOWN', 'FLOOR', 'CEIL'] })
  @IsOptional()
  @IsString()
  rounding?: string;

  @ApiPropertyOptional({ description: 'Whether shipping is taxable' })
  @IsOptional()
  shippingIsTaxable?: boolean;
}

/**
 * Config snapshot shipping configuration
 */
export class ShippingConfigDto {
  @ApiPropertyOptional({ description: 'Shipping profile reference ID' })
  @IsOptional()
  @IsString()
  profileRefId?: string;

  @ApiPropertyOptional({ description: 'Grouping strategy', enum: ['BY_WAREHOUSE', 'BY_VENDOR', 'SINGLE'] })
  @IsOptional()
  @IsString()
  grouping?: string;

  @ApiPropertyOptional({ description: 'Rating strategy', enum: ['CARRIER_QUOTE', 'TABLE_RATE', 'FLAT_RATE'] })
  @IsOptional()
  @IsString()
  ratingStrategy?: string;

  @ApiPropertyOptional({ description: 'Fallback strategy', enum: ['TABLE_RATE', 'FLAT_RATE', 'ERROR'] })
  @IsOptional()
  @IsString()
  fallbackStrategy?: string;

  @ApiPropertyOptional({ description: 'Free shipping threshold in minor units' })
  @IsOptional()
  @IsNumber()
  freeShippingThresholdMinor?: number;
}

/**
 * Allocation rule configuration
 */
export class AllocationRuleDto {
  @ApiProperty({ description: 'Allocation basis', enum: ['PROPORTIONAL_VALUE', 'PROPORTIONAL_QTY', 'WEIGHT', 'EQUAL'] })
  @IsString()
  basis: string;

  @ApiPropertyOptional({ description: 'Fallback basis' })
  @IsOptional()
  @IsString()
  fallback?: string;
}

/**
 * Config snapshot allocation configuration
 */
export class AllocationConfigDto {
  @ApiPropertyOptional({ description: 'Allocation rules by charge type' })
  @IsOptional()
  @IsObject()
  rules?: {
    DISCOUNT?: AllocationRuleDto;
    SHIPPING?: AllocationRuleDto;
    HANDLING?: AllocationRuleDto;
    [key: string]: AllocationRuleDto | undefined;
  };

  @ApiPropertyOptional({ description: 'Residual allocation strategy' })
  @IsOptional()
  @IsObject()
  residual?: {
    strategy: 'ASSIGN_TO_HIGHEST_VALUE_ITEM' | 'ASSIGN_TO_FIRST_ITEM' | 'SPREAD';
  };
}

/**
 * Config snapshot catalog pricing configuration
 */
export class CatalogPricingConfigDto {
  @ApiPropertyOptional({ description: 'Price list reference ID' })
  @IsOptional()
  @IsString()
  priceListRefId?: string;

  @ApiPropertyOptional({ description: 'Price list code' })
  @IsOptional()
  @IsString()
  priceListCode?: string;

  @ApiPropertyOptional({ description: 'Fallback strategy', enum: ['LAST_KNOWN_PRICE', 'ERROR'] })
  @IsOptional()
  @IsString()
  fallbackStrategy?: string;
}

/**
 * Full config snapshot DTO
 */
export class ConfigSnapshotDto {
  @ApiProperty({ description: 'Schema version', example: '1.0' })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty({ description: 'Currency code', example: 'KES' })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiPropertyOptional({ description: 'Catalog pricing configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CatalogPricingConfigDto)
  catalogPricing?: CatalogPricingConfigDto;

  @ApiPropertyOptional({ description: 'Tax configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => TaxConfigDto)
  tax?: TaxConfigDto;

  @ApiPropertyOptional({ description: 'Shipping configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingConfigDto)
  shipping?: ShippingConfigDto;

  @ApiPropertyOptional({ description: 'Allocation configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AllocationConfigDto)
  allocation?: AllocationConfigDto;
}

/**
 * DTO for creating a pricebook revision (draft)
 */
export class CreatePricebookRevisionDto {
  @ApiProperty({ description: 'Currency code', example: 'KES' })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiProperty({ description: 'Config snapshot' })
  @ValidateNested()
  @Type(() => ConfigSnapshotDto)
  configSnapshot: ConfigSnapshotDto;

  @ApiPropertyOptional({ description: 'Price list IDs to associate', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  priceListIds?: string[];
}

/**
 * DTO for updating a pricebook revision (draft only)
 */
export class UpdatePricebookRevisionDto {
  @ApiPropertyOptional({ description: 'Config snapshot' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConfigSnapshotDto)
  configSnapshot?: ConfigSnapshotDto;

  @ApiPropertyOptional({ description: 'Effective from date' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'Effective to date' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ description: 'Price list IDs to associate', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  priceListIds?: string[];
}

/**
 * DTO for publishing a revision
 */
export class PublishPricebookRevisionDto {
  @ApiProperty({ description: 'Effective from date' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ description: 'Effective to date (null for indefinite)' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;
}
