import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { EntitlementKey } from '../entities/customer-group-entitlement.entity';

export class UpsertCustomerGroupEntitlementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  groupId: string;

  @ApiProperty({
    enum: [
      'PURCHASE_QUOTE',
      'PURCHASE_SUBSCRIBE',
      'ALLOW_BACKORDER',
      'FREE_DELIVERY',
      'SHOW_UNIT_PRICE',
      'SHOW_TIER_TABLE',
    ],
  })
  @IsIn([
    'PURCHASE_QUOTE',
    'PURCHASE_SUBSCRIBE',
    'ALLOW_BACKORDER',
    'FREE_DELIVERY',
    'SHOW_UNIT_PRICE',
    'SHOW_TIER_TABLE',
  ])
  key: EntitlementKey;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  paramsJson?: Record<string, unknown>;
}
