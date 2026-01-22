import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * DTO for creating a new Pricebook
 */
export class CreatePricebookDto {
  @ApiProperty({ description: 'Unique pricebook code', example: 'DEFAULT' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Display name', example: 'Default Pricebook' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether pricebook is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Channel IDs to associate', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  channelIds?: string[];

  @ApiPropertyOptional({ description: 'Customer group IDs to associate', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  customerGroupIds?: string[];

  @ApiPropertyOptional({ description: 'Sales channel IDs to associate', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  salesChannelIds?: string[];

  @ApiPropertyOptional({ description: 'Country codes to associate', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countryCodes?: string[];
}

/**
 * DTO for updating a Pricebook
 */
export class UpdatePricebookDto {
  @ApiPropertyOptional({ description: 'Unique pricebook code' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @ApiPropertyOptional({ description: 'Display name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether pricebook is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Channel IDs to associate', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  channelIds?: string[];

  @ApiPropertyOptional({ description: 'Customer group IDs to associate', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  customerGroupIds?: string[];

  @ApiPropertyOptional({ description: 'Sales channel IDs to associate', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  salesChannelIds?: string[];

  @ApiPropertyOptional({ description: 'Country codes to associate', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countryCodes?: string[];
}
