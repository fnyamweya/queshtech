import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCustomerGroupMemberDto {
  @ApiPropertyOptional({ example: '2025-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  validFrom?: string | null;

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsString()
  validTo?: string | null;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  metaJson?: Record<string, unknown>;
}
