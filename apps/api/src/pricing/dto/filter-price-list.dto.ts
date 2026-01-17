import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationFilterDto } from 'src/common/dto/pagination-filter.dto';

const PRICE_LIST_STATUS = ['active', 'inactive', 'archived'] as const;
const PRICE_LIST_TYPE = ['BASE', 'OVERRIDE', 'PROMOTION', 'CONTRACT'] as const;

export class FilterPriceListDto extends PaginationFilterDto {
  @ApiPropertyOptional({ description: 'Search by code or name', example: 'ke' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by currency (ISO3)',
    example: 'KES',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  currency?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: PRICE_LIST_STATUS,
    example: 'active',
  })
  @IsOptional()
  @IsIn(PRICE_LIST_STATUS as unknown as string[])
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by type',
    enum: PRICE_LIST_TYPE,
    example: 'BASE',
  })
  @IsOptional()
  @IsIn(PRICE_LIST_TYPE as unknown as string[])
  type?: string;
}
