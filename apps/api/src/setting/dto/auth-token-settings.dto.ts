import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpsertAuthTokenSettingsDto {
  @ApiPropertyOptional({
    description: 'Customer access token TTL in seconds',
    example: 900,
    minimum: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  customerAccessTokenTtlSeconds?: number;

  @ApiPropertyOptional({
    description: 'Customer refresh token TTL in seconds',
    example: 604800,
    minimum: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(300)
  customerRefreshTokenTtlSeconds?: number;

  @ApiPropertyOptional({
    description: 'Admin access token TTL in seconds',
    example: 1800,
    minimum: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  adminAccessTokenTtlSeconds?: number;

  @ApiPropertyOptional({
    description: 'Admin refresh token TTL in seconds',
    example: 86400,
    minimum: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(300)
  adminRefreshTokenTtlSeconds?: number;
}

export class AuthTokenSettingsResponseDto {
  @ApiProperty({ description: 'Customer access token TTL in seconds', example: 900 })
  customerAccessTokenTtlSeconds: number;

  @ApiProperty({ description: 'Customer refresh token TTL in seconds', example: 604800 })
  customerRefreshTokenTtlSeconds: number;

  @ApiProperty({ description: 'Admin access token TTL in seconds', example: 1800 })
  adminAccessTokenTtlSeconds: number;

  @ApiProperty({ description: 'Admin refresh token TTL in seconds', example: 86400 })
  adminRefreshTokenTtlSeconds: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  createdAt?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  updatedAt?: Date;
}
