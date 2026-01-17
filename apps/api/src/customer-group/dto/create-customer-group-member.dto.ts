import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { MemberType } from '../entities/customer-group-member.entity';

export class CreateCustomerGroupMemberDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  groupId: string;

  @ApiProperty({ enum: ['customer', 'org'] })
  @IsIn(['customer', 'org'])
  memberType: MemberType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  memberId: string;

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
  metaJson?: Record<string, unknown>;
}
