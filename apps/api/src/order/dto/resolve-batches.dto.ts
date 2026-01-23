import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class ResolveBatchesDto {
  @ApiPropertyOptional({
    description: 'Optional warehouse ID to assign to the single resolved batch.',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Optional strategy hint stored into runtimeContext (for future multi-warehouse logic).',
    example: 'SINGLE',
  })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  warehouseGrouping?: string;

  @ApiPropertyOptional({
    description: 'Whether to include non-shippable items in batches (default false).',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeNonShippable?: boolean;
}
