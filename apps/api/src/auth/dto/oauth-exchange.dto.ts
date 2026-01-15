import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class OAuthExchangeDto {
  @ApiProperty({ example: 'uH8...base64url...' })
  @IsString()
  @IsNotEmpty()
  exchangeCode: string;

  @ApiProperty({
    description:
      'The Google OAuth profile key/id used to initiate the OAuth flow. Exchange codes are bound to this value.',
    example: 'axis',
  })
  @IsString()
  @IsNotEmpty()
  oauthKey: string;
}
