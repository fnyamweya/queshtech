import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PublicListProductsDto } from './public-list-products.dto';

export class PublicListProductsViewDto extends PublicListProductsDto {
  @ApiPropertyOptional({
    description:
      'Customer group/segment. For authenticated requests this is resolved server-side (query param is ignored).',
  })
  @IsOptional()
  @IsString()
  customerGroup?: string;

  @ApiPropertyOptional({
    description: 'Role identifier (e.g. agent, admin, customer)',
  })
  @IsOptional()
  @IsString()
  role?: string;
}
