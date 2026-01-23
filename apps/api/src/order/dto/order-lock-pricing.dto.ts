import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class LockPricingDto {
  @ApiPropertyOptional({
    description:
      'Optional idempotency key from the client (used for safe retries).',
    example: 'ck_01JXYZ...',
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  clientIdempotencyKey?: string;
}
