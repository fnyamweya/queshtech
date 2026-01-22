import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class PublicListCategoriesDto {
  @ApiPropertyOptional({ description: 'Page number (default 1)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Page size (default 20)', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by active status (default true)',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by homepage flag',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isHomepage?: boolean;

  @ApiPropertyOptional({
    description: 'Optional taxonomy id to scope the results',
  })
  @IsOptional()
  @IsUUID('4')
  taxonomyId?: string;

  @ApiPropertyOptional({
    description: 'Preferred locale for translated fields',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  locale?: string;
}
