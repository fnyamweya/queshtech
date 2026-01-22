import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for creating a pricebook assignment
 */
export class CreatePricebookAssignmentDto {
  @ApiProperty({ description: 'Pricebook ID' })
  @IsUUID()
  pricebookId: string;

  @ApiPropertyOptional({ description: 'Channel ID (null for wildcard)' })
  @IsOptional()
  @IsUUID()
  channelId?: string;

  @ApiPropertyOptional({ description: 'Customer group ID (null for wildcard)' })
  @IsOptional()
  @IsUUID()
  customerGroupId?: string;

  @ApiPropertyOptional({ description: 'Country code (null for wildcard)' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({ description: 'Sales channel ID (null for wildcard)' })
  @IsOptional()
  @IsUUID()
  salesChannelId?: string;

  @ApiPropertyOptional({ description: 'Merchant ID (null for wildcard)' })
  @IsOptional()
  @IsUUID()
  merchantId?: string;

  @ApiPropertyOptional({ description: 'Priority (higher wins)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: 'Whether assignment is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Additional conditions (extensibility)' })
  @IsOptional()
  @IsObject()
  conditionsJson?: Record<string, unknown>;
}

/**
 * DTO for updating a pricebook assignment
 */
export class UpdatePricebookAssignmentDto {
  @ApiPropertyOptional({ description: 'Pricebook ID' })
  @IsOptional()
  @IsUUID()
  pricebookId?: string;

  @ApiPropertyOptional({ description: 'Channel ID (null for wildcard)' })
  @IsOptional()
  @IsUUID()
  channelId?: string | null;

  @ApiPropertyOptional({ description: 'Customer group ID (null for wildcard)' })
  @IsOptional()
  @IsUUID()
  customerGroupId?: string | null;

  @ApiPropertyOptional({ description: 'Country code (null for wildcard)' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string | null;

  @ApiPropertyOptional({ description: 'Sales channel ID (null for wildcard)' })
  @IsOptional()
  @IsUUID()
  salesChannelId?: string | null;

  @ApiPropertyOptional({ description: 'Merchant ID (null for wildcard)' })
  @IsOptional()
  @IsUUID()
  merchantId?: string | null;

  @ApiPropertyOptional({ description: 'Priority (higher wins)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: 'Whether assignment is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Additional conditions' })
  @IsOptional()
  @IsObject()
  conditionsJson?: Record<string, unknown>;
}

/**
 * DTO for setting the default assignment (single-channel convenience)
 */
export class SetDefaultAssignmentDto {
  @ApiProperty({ description: 'Pricebook ID' })
  @IsUUID()
  pricebookId: string;

  @ApiPropertyOptional({ description: 'Priority', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: 'Whether assignment is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
