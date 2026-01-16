import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertAlgoliaCatalogSettingDto {
  @ApiPropertyOptional({
    description: 'Enable Algolia-powered catalog search.',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'enabled must be a boolean value' })
  @Transform(({ value }) => value === 'true' || value === true)
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Algolia Application ID (required when enabled).',
    example: 'ABC123DEF',
    maxLength: 64,
  })
  @IsOptional()
  @IsString({ message: 'appId must be a string' })
  @MaxLength(64, { message: 'appId must not exceed 64 characters' })
  appId?: string;

  @ApiPropertyOptional({
    description:
      'Algolia Search-Only API key. Safe to expose to the storefront. Required for client-side search.',
    example: 'xxxx-search-only-key',
    maxLength: 256,
  })
  @IsOptional()
  @IsString({ message: 'searchApiKey must be a string' })
  @MaxLength(256, { message: 'searchApiKey must not exceed 256 characters' })
  searchApiKey?: string;

  @ApiPropertyOptional({
    description:
      'Optional index prefix to separate environments (e.g. dev/staging/prod).',
    example: 'dev',
    maxLength: 64,
  })
  @IsOptional()
  @IsString({ message: 'indexPrefix must be a string' })
  @MaxLength(64, { message: 'indexPrefix must not exceed 64 characters' })
  indexPrefix?: string;

  @ApiPropertyOptional({
    description: 'Base index name for catalog products (prefix will be applied).',
    example: 'catalog_products',
    maxLength: 128,
  })
  @IsOptional()
  @IsString({ message: 'productsIndexName must be a string' })
  @MaxLength(128, {
    message: 'productsIndexName must not exceed 128 characters',
  })
  productsIndexName?: string;

  @ApiPropertyOptional({
    description:
      'Algolia index settings payload (passed to setSettings). This allows configuring ALL Algolia index settings for best UX.',
    example: {
      searchableAttributes: ['title', 'slug', 'skuCodes'],
      attributesForFaceting: ['filterOnly(status)', 'filterOnly(brandId)'],
      typoTolerance: true,
    },
  })
  @IsOptional()
  @IsObject({ message: 'indexSettingsJson must be an object' })
  indexSettingsJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Default Algolia search params used by the storefront (passed to search). This allows configuring per-query UX (hitsPerPage, attributesToHighlight, etc).',
    example: {
      hitsPerPage: 8,
      clickAnalytics: true,
      attributesToHighlight: ['title', 'brandName'],
    },
  })
  @IsOptional()
  @IsObject({ message: 'searchParamsJson must be an object' })
  searchParamsJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Minimum query length before the UI triggers a search. Helps reduce noise/requests.',
    example: 2,
    default: 2,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  minQueryLength?: number;

  @ApiPropertyOptional({
    description:
      'Client-side debounce in milliseconds before running search queries. Improves perceived performance.',
    example: 150,
    default: 150,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  debounceMs?: number;
}

export class UpdateAlgoliaCatalogSecretDto {
  @ApiPropertyOptional({
    description:
      'Algolia Admin API key (stored encrypted at rest). Never returned by the API. Send an empty string to clear.',
    example: 'xxxx-admin-key',
    maxLength: 512,
  })
  @IsOptional()
  @IsString({ message: 'adminApiKey must be a string' })
  @MaxLength(512, { message: 'adminApiKey must not exceed 512 characters' })
  adminApiKey?: string;
}

export class AlgoliaCatalogSettingResponseDto {
  @ApiPropertyOptional({ example: true })
  enabled?: boolean;

  @ApiPropertyOptional({ example: 'ABC123DEF' })
  appId?: string;

  @ApiPropertyOptional({ example: true })
  hasAdminApiKey?: boolean;

  @ApiPropertyOptional({ example: true })
  hasSearchApiKey?: boolean;

  @ApiPropertyOptional({ example: 'search-only-key' })
  searchApiKey?: string;

  @ApiPropertyOptional({ example: 'dev' })
  indexPrefix?: string;

  @ApiPropertyOptional({ example: 'catalog_products' })
  productsIndexName?: string;

  @ApiPropertyOptional({ example: 'dev_catalog_products' })
  effectiveProductsIndexName?: string;

  @ApiPropertyOptional({
    example: { searchableAttributes: ['title', 'slug'] },
  })
  indexSettingsJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: { hitsPerPage: 8 },
  })
  searchParamsJson?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 2 })
  minQueryLength?: number;

  @ApiPropertyOptional({ example: 150 })
  debounceMs?: number;

  @ApiPropertyOptional()
  createdAt?: Date;

  @ApiPropertyOptional()
  updatedAt?: Date;
}

export class AlgoliaCatalogSecretResponseDto {
  @ApiPropertyOptional({ example: true })
  hasAdminApiKey?: boolean;

  @ApiPropertyOptional()
  updatedAt?: Date;
}
