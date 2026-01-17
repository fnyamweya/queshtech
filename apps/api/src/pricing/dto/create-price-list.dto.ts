import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const PRICE_LIST_STATUS = ['active', 'inactive', 'archived'] as const;
const PRICE_LIST_TYPE = ['BASE', 'OVERRIDE', 'PROMOTION', 'CONTRACT'] as const;
const STACKING_POLICY = ['EXCLUSIVE', 'STACKABLE'] as const;
const CONFLICT_POLICY = [
  'HIGHEST_PRIORITY',
  'LOWEST_PRICE',
  'FIRST_MATCH',
] as const;

export class CreatePriceListDto {
  @ApiProperty({ description: 'Unique price list code', example: 'ke-retail' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Display name', example: 'Kenya Retail' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Currency (ISO3)', example: 'KES' })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiPropertyOptional({
    description: 'Price list type',
    enum: PRICE_LIST_TYPE,
    example: 'BASE',
  })
  @IsOptional()
  @IsIn(PRICE_LIST_TYPE as unknown as string[])
  type?: string;

  @ApiPropertyOptional({
    description: 'Priority (higher wins by default)',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({
    description:
      'Dynamic scope selector. Can store channel/country/customer segment/etc without schema changes.',
    example: { countryCode: 'KE', channel: 'web' },
  })
  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Status',
    enum: PRICE_LIST_STATUS,
    example: 'active',
  })
  @IsOptional()
  @IsIn(PRICE_LIST_STATUS as unknown as string[])
  status?: string;

  @ApiPropertyOptional({
    description: 'Stacking policy',
    enum: STACKING_POLICY,
    example: 'EXCLUSIVE',
  })
  @IsOptional()
  @IsIn(STACKING_POLICY as unknown as string[])
  stackingPolicy?: string;

  @ApiPropertyOptional({
    description: 'Conflict policy (preferred)',
    enum: CONFLICT_POLICY,
    example: 'HIGHEST_PRIORITY',
  })
  @IsOptional()
  @IsIn(CONFLICT_POLICY as unknown as string[])
  conflictPolicy?: string;

  @ApiPropertyOptional({
    description: 'Match policy (deprecated, use conflictPolicy)',
    enum: CONFLICT_POLICY,
    example: 'HIGHEST_PRIORITY',
  })
  @IsOptional()
  @IsIn(CONFLICT_POLICY as unknown as string[])
  matchPolicy?: string;

  @ApiPropertyOptional({
    description: 'Stop after first match (when evaluating rows)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  stopAfterMatch?: boolean;

  @ApiPropertyOptional({
    description: 'Valid from date (ISO)',
    example: '2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({
    description: 'Valid to date (ISO)',
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional({
    description: 'Price list metadata',
    example: { priority: 0 },
  })
  @IsOptional()
  @IsObject()
  metaJson?: Record<string, unknown>;
}
