import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

/**
 * Draft repricing request:
 * - resolves the effective pricebook revision
 * - upserts an unlocked pricing snapshot
 * - runs the pricing pipeline to produce immutable artifacts
 */
export class RepriceOrderDto {
  @ApiPropertyOptional({ description: 'Currency code override (defaults to order.currencyCode)', example: 'KES' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Point in time for pricebook resolution (default: now)' })
  @IsOptional()
  @IsDateString()
  at?: string;

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

  @ApiPropertyOptional({ description: 'Pricing engine version', example: 'pricing-engine@1.0.0' })
  @IsOptional()
  @IsString()
  pricingEngineVersion?: string;

  @ApiPropertyOptional({ description: 'Runtime context (delivery groups, carrier quotes, promo codes, etc.)' })
  @IsOptional()
  @IsObject()
  runtimeContext?: Record<string, unknown>;
}
