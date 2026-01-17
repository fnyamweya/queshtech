import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CustomerGroupStatus, CustomerGroupType } from '../entities/customer-group.entity';

export class CreateCustomerGroupDto {
  @ApiProperty({ example: 'RETAIL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code: string;

  @ApiProperty({ example: 'Retail' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name: string;

  @ApiPropertyOptional({ example: 'Default retail group' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @ApiPropertyOptional({ enum: ['retail', 'member', 'wholesale', 'vip', 'employee', 'partner', 'b2b_contract'] })
  @IsOptional()
  @IsIn(['retail', 'member', 'wholesale', 'vip', 'employee', 'partner', 'b2b_contract'])
  groupType?: CustomerGroupType;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'archived'] })
  @IsOptional()
  @IsIn(['active', 'inactive', 'archived'])
  status?: CustomerGroupStatus;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isStackable?: boolean;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsString()
  validTo?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  featuresJson?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Array })
  @IsOptional()
  eligibilityRulesJson?: unknown[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  pricePolicyJson?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metaJson?: Record<string, unknown>;
}
