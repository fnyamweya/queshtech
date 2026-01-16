import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {
	@ApiPropertyOptional({
		description:
			"How to interpret 'skus' on update: replace = treat payload SKUs as the full set; patch = only touch the provided SKUs",
		enum: ['replace', 'patch'],
		default: 'replace',
	})
	@IsOptional()
	@IsEnum(['replace', 'patch'] as const)
	skusMode?: 'replace' | 'patch';
}
