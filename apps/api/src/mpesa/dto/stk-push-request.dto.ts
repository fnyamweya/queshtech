import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class StkPushRequestDto {
  @ApiProperty({ description: 'Phone number (MSISDN) to receive STK prompt', example: '254712345678' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: 'Amount to charge', example: 1200 })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ description: 'Order id to link payment', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Account reference shown to user', example: 'ORDER-10023' })
  @IsOptional()
  @IsString()
  accountReference?: string;

  @ApiPropertyOptional({ description: 'Transaction description', example: 'Order payment' })
  @IsOptional()
  @IsString()
  transactionDesc?: string;

  @ApiPropertyOptional({ description: 'Override shortcode', example: '174379' })
  @IsOptional()
  @IsString()
  shortCode?: string;

  @ApiPropertyOptional({ description: 'Override passkey' })
  @IsOptional()
  @IsString()
  passkey?: string;

  @ApiPropertyOptional({ description: 'Override callback URL' })
  @IsOptional()
  @IsString()
  callbackUrl?: string;
}
