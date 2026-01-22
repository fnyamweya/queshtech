import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

/**
 * DTO for resolving a pricebook (runtime)
 */
export class ResolvePricebookDto {
  @ApiProperty({ description: 'Currency code', example: 'KES' })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiPropertyOptional({ description: 'Point in time for resolution (default: now)' })
  @IsOptional()
  @IsDateString()
  at?: string;

  // Future-ready routing dimensions
  @ApiPropertyOptional({ description: 'Channel ID' })
  @IsOptional()
  @IsUUID()
  channelId?: string;

  @ApiPropertyOptional({ description: 'Customer group ID' })
  @IsOptional()
  @IsUUID()
  customerGroupId?: string;

  @ApiPropertyOptional({ description: 'Country code' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({ description: 'Sales channel ID' })
  @IsOptional()
  @IsUUID()
  salesChannelId?: string;

  @ApiPropertyOptional({ description: 'Merchant ID' })
  @IsOptional()
  @IsUUID()
  merchantId?: string;
}

/**
 * DTO for upserting an order pricing snapshot
 */
export class UpsertOrderPricingSnapshotDto {
  @ApiProperty({ description: 'Currency code', example: 'KES' })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiProperty({ description: 'Pricebook revision ID' })
  @IsUUID()
  pricebookRevisionId: string;

  @ApiPropertyOptional({ description: 'Pricing engine version', example: 'pricing-engine@1.7.3' })
  @IsOptional()
  @IsString()
  pricingEngineVersion?: string;

  @ApiPropertyOptional({ description: 'Runtime context (warehouse grouping, carrier quotes, etc.)' })
  @IsOptional()
  @IsObject()
  runtimeContext?: Record<string, unknown>;
}

/**
 * Response for pricebook resolution
 */
export class PricebookResolutionResponse {
  pricebookId: string;
  pricebookCode: string;
  pricebookRevisionId: string;
  revisionNumber: number;
  currency: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  routing: {
    assignmentId: string;
    priority: number;
    specificityScore: number;
  };
}

/**
 * Validation result for revision
 */
export class RevisionValidationResult {
  valid: boolean;
  issues: Array<{
    code: string;
    path: string;
    message: string;
  }>;
}
