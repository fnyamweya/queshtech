import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, IsUrl } from 'class-validator';

export class ProductImageDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  url: string;

  @ApiPropertyOptional()
  alt?: string;

  @ApiPropertyOptional()
  skuId?: string;

  @ApiPropertyOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  sortOrder?: number;
}

export class CreateProductImageDto {
  @ApiProperty({ description: 'Image URL', example: 'https://cdn.example.com/products/1.png' })
  @IsString()
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ description: 'Alt text', example: 'Front view' })
  @IsOptional()
  @IsString()
  alt?: string;

  @ApiPropertyOptional({ description: 'Related SKU id', example: 'uuid' })
  @IsOptional()
  @IsUUID()
  skuId?: string;

  @ApiPropertyOptional({ description: 'Primary image', example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'Sort order', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;
}
