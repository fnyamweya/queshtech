import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class ProductOptionDefinitionDto {
  @ApiProperty({ description: 'Option key', example: 'color' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiPropertyOptional({ description: 'Human label', example: 'Color' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    description: 'Allowed values. If omitted, any string is allowed.',
    example: ['black', 'white'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedValues?: string[];

  @ApiPropertyOptional({
    description: 'Whether this option is required on SKUs',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({
    description:
      'Optional UI hint for how this option should be rendered in clients (e.g. select, radio, color_swatch). Stored as metadata only.',
    example: 'color_swatch',
  })
  @IsOptional()
  @IsString()
  componentType?: string;
}
