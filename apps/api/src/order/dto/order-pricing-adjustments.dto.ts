import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PricingAdjustmentLineDto {
  @ApiProperty({
    description: 'Signed amount of the adjustment (can be negative).',
    example: -50,
  })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  amount: number;

  @ApiPropertyOptional({ example: 'Manual correction' })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Machine-readable reason/code for the adjustment.',
    example: 'manual_adjustment',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Optional metadata for audit/debugging.',
    example: { note: 'Promo goodwill' },
  })
  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

export class ApplyPricingAdjustmentsDto {
  @ApiPropertyOptional({
    description: 'Optional idempotency key from the client (used for safe retries).',
    example: 'adj_01JXYZ...',
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  clientIdempotencyKey?: string;

  @ApiProperty({ type: [PricingAdjustmentLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PricingAdjustmentLineDto)
  adjustments: PricingAdjustmentLineDto[];
}
