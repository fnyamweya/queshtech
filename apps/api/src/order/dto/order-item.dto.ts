import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemPricingDto {
  @ApiProperty({ example: '100.0000' })
  unitPrice: string;

  @ApiProperty({ example: '200.0000' })
  baseSubtotal: string;

  @ApiProperty({ example: '20.0000' })
  discountTotal: string;

  @ApiProperty({ example: '0.0000' })
  feeTotal: string;

  @ApiProperty({ example: '28.8000' })
  taxTotal: string;

  @ApiProperty({ example: '208.8000' })
  total: string;
}

export class OrderItemDto {
  @ApiProperty({ example: '2f6f4c1f-7a01-4f2f-8d72-6d07d2b53d13' })
  id: string;

  @ApiProperty({ example: 'a0b1c2d3-e4f5-6789-0123-456789abcdef' })
  orderId: string;

  @ApiProperty({ example: '3a3d0e5e-5b69-4c1f-8df3-7a6d7c2c0b11' })
  productSkuId: string;

  @ApiPropertyOptional({ example: 'SKU-1' })
  sku?: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: true })
  requiresShipping: boolean;

  @ApiProperty({ type: () => OrderItemPricingDto })
  pricing: OrderItemPricingDto;

  @ApiProperty({ example: '2026-01-06T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-01-06T12:00:00.000Z' })
  updatedAt: string;

}
