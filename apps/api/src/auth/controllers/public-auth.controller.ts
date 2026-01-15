import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ResponseUtil } from 'src/common/utils/response.util';
import { GoogleOAuthGuard } from '../guards/google-oauth.guard';
import { OAuthProfile } from '../interfaces/oauth-profile.interface';
import { AuthService } from '../services/auth.service';
import { OAuthExchangeService } from '../services/oauth-exchange.service';
import { OAuthExchangeDto } from '../dto/oauth-exchange.dto';

@Controller({ path: 'auth', version: VERSION_NEUTRAL })
@ApiTags('Authentication')
export class PublicAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthExchangeService: OAuthExchangeService,
  ) {}

  private normalizeRedirectPath(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    if (!value) return null;
    // Only allow same-origin relative redirects to avoid open redirect vulnerabilities.
    if (!value.startsWith('/')) return null;
    if (value.startsWith('//')) return null;
    return value;
  }

  private appendQueryParam(urlLike: string, key: string, value: string): string {
    const [beforeHash, hash] = urlLike.split('#', 2);
    const sep = beforeHash.includes('?') ? '&' : '?';
    const updated = `${beforeHash}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    return hash ? `${updated}#${hash}` : updated;
  }

  @Get(':oauthKey/google/callback')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({
    summary:
      'Google OAuth 2.0 callback using a profile key (no /api prefix)',
  })
  @ApiOkResponse({ description: 'Login via Google successful' })
  async googleCallbackByKey(
    @Req() request: Request,
    @Res({ passthrough: false }) response: Response,
  ) {
    const profile = request.user as OAuthProfile;

    const oauthKey = String(
      (request as any)?.params?.oauthKey ||
        (request as any)?.__oauthGoogleSettingId ||
        '',
    ).trim();

    const redirectRaw = (request as any).__oauthRedirect as string | undefined;
    const redirectPath = this.normalizeRedirectPath(redirectRaw);

    let userId: string;
    try {
      const result = await this.authService.authorizeWithGoogleOAuth(profile, request);
      userId = result.userId;
    } catch (err: any) {
      // If the client asked for a UI redirect, redirect with standard OAuth-style error params.
      if (redirectPath) {
        const description =
          typeof err?.message === 'string' && err.message.trim().length > 0
            ? err.message.trim()
            : 'OAuth authorization failed';
        const withError = this.appendQueryParam(redirectPath, 'error', 'access_denied');
        const location = this.appendQueryParam(withError, 'error_description', description);
        return response.redirect(302, location);
      }
      throw err;
    }

    const exchangeCode = await this.oauthExchangeService.issue(userId, oauthKey);

    if (!redirectPath) {
      return response.status(200).json(
        ResponseUtil.success(
          { exchangeCode },
          'OAuth successful. Exchange code issued.',
        ),
      );
    }

    const location = this.appendQueryParam(
      redirectPath,
      'exchangeCode',
      exchangeCode,
    );
    return response.redirect(302, location);
  }

  @Get(':oauthKey/google')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({
    summary:
      'Initiate Google OAuth 2.0 login using a profile key (no /api prefix)',
  })
  @ApiOkResponse({ description: 'Redirecting to Google OAuth 2.0' })
  async googleAuthByKey() {
    return ResponseUtil.success(
      null,
      'Redirecting to Google OAuth 2.0 for authentication',
    );
  }

  @Post('oauth/exchange')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Exchange a one-time OAuth exchangeCode for login tokens (bound to oauthKey + role-scoped)',
    description:
      'Used after the server-side OAuth callback redirects back to the client with an exchangeCode.',
  })
  @ApiOkResponse({ description: 'Login successful' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired exchangeCode' })
  async oauthExchange(@Body() dto: OAuthExchangeDto, @Req() request: Request) {
    const { userId, oauthKey } = await this.oauthExchangeService.consume(dto.exchangeCode);
    if (!oauthKey || oauthKey !== dto.oauthKey) {
      // Prevent cross-app/redirect mixing of exchange codes.
      // Example: customer flow exchangeCode should not be usable for Axis.
      throw new UnauthorizedException(
        'Exchange code is not valid for this OAuth profile',
      );
    }

    // Re-check role eligibility at exchange time to avoid granting tokens if roles/settings changed.
    await this.authService.assertUserAllowedForGoogleOAuthProfile(userId, oauthKey);
    const result = await this.authService.loginUserById(userId, request);
    return ResponseUtil.success(result, 'Login successful');
  }
}
