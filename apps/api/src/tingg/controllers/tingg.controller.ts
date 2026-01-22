import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ResponseUtil } from 'src/common/utils/response.util';
import { TinggService } from '../services/tingg.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';

@ApiTags('Tingg')
@Controller('tingg')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class TinggController {
  constructor(private readonly tinggService: TinggService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create Tingg express checkout URLs' })
  async createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      orderId: string;
      amount: number;
      currency: string;
      phone: string;
      firstName: string;
      lastName: string;
      email?: string;
    },
  ) {
    const payload = await this.tinggService.createExpressCheckout({
      orderId: body.orderId,
      amount: body.amount,
      currency: body.currency,
      phone: body.phone,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
    });
    return ResponseUtil.success(payload, 'Tingg checkout created');
  }

  @Post('callback')
  @ApiOperation({ summary: 'Tingg callback webhook' })
  async callback(@Req() req: any, @Body() body: any) {
    await this.tinggService.handleCallback(body);
    return ResponseUtil.success({ received: true }, 'Callback received');
  }
}
