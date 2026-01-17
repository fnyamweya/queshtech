import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PublicAlgoliaProductSearchDto {
  @ApiPropertyOptional({ description: 'Search query', example: 'iphone' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: '1-based page number', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Page size (hitsPerPage)', example: 20, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: "Optional Algolia filter expression (will be AND'ed with status:active)",
    example: 'brandId:123',
  })
  @IsOptional()
  @IsString()
  filters?: string;
}
