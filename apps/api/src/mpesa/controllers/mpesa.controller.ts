import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { PermissionModule } from 'src/auth/entities/permission.entity';
import { ResponseUtil } from 'src/common/utils/response.util';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from 'src/auth/interfaces/user.interface';
import { MpesaService } from '../services/mpesa.service';
import { C2BRegisterUrlsDto } from '../dto/c2b-register-urls.dto';
import { C2BSimulateDto } from '../dto/c2b-simulate.dto';
import { B2CPaymentRequestDto } from '../dto/b2c-payment-request.dto';
import { B2BPaymentRequestDto } from '../dto/b2b-payment-request.dto';
import { StkPushRequestDto } from '../dto/stk-push-request.dto';

@ApiTags('Mpesa (Daraja)')
@Controller('mpesa')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class MpesaController {
  private readonly logger = new Logger(MpesaController.name);

  constructor(private readonly mpesaService: MpesaService) {}

  // --- Protected endpoints (your frontend/server triggers these) ---

  @Post('c2b/register-urls')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.MPESA, permission: 'update' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Register C2B confirmation/validation URLs' })
  async registerC2BUrls(@Body() dto: C2BRegisterUrlsDto) {
    const data = await this.mpesaService.registerC2BUrls(dto);
    return ResponseUtil.success(data, 'C2B URLs registered', 201);
  }

  @Post('c2b/simulate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.MPESA, permission: 'create' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Simulate a C2B payment (sandbox only)' })
  async simulateC2B(@Body() dto: C2BSimulateDto) {
    const data = await this.mpesaService.simulateC2B(dto);
    return ResponseUtil.success(data, 'C2B simulation requested', 201);
  }

  @Post('b2c/payment')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.MPESA, permission: 'create' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Initiate a B2C payment' })
  async b2cPayment(@Body() dto: B2CPaymentRequestDto) {
    const data = await this.mpesaService.b2cPayment(dto);
    return ResponseUtil.success(data, 'B2C payment requested', 201);
  }

  @Post('b2b/payment')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ module: PermissionModule.MPESA, permission: 'create' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Initiate a B2B payment' })
  async b2bPayment(@Body() dto: B2BPaymentRequestDto) {
    const data = await this.mpesaService.b2bPayment(dto);
    return ResponseUtil.success(data, 'B2B payment requested', 201);
  }

  @Post('stk/push')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Initiate an STK push payment' })
  async stkPush(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StkPushRequestDto,
  ) {
    const data = await this.mpesaService.stkPush(dto, user.id);
    return ResponseUtil.success(data, 'STK push requested', 201);
  }

  @Get('stk/status/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Check STK payment status by order id' })
  async stkStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    const data = await this.mpesaService.getStkStatus(orderId, user.id);
    return ResponseUtil.success(data, 'STK status retrieved');
  }

  // --- Public callback endpoints (Daraja calls these) ---

  @Post('c2b/validation')
  @ApiOperation({ summary: 'Daraja C2B validation callback' })
  async c2bValidation(@Body() body: any, @Req() req: Request) {
    this.logger.log(`C2B validation callback from ${req.ip}`);
    this.logger.debug(body);
    // IMPORTANT: return Daraja expected schema (do not wrap)
    return this.mpesaService.handleC2BValidation(body);
  }

  @Post('c2b/confirmation')
  @ApiOperation({ summary: 'Daraja C2B confirmation callback' })
  async c2bConfirmation(@Body() body: any, @Req() req: Request) {
    this.logger.log(`C2B confirmation callback from ${req.ip}`);
    this.logger.debug(body);
    // Daraja generally expects 200 OK
    return this.mpesaService.handleC2BConfirmation(body);
  }

  @Post('b2c/result')
  @ApiOperation({ summary: 'Daraja B2C result callback' })
  async b2cResult(@Body() body: any, @Req() req: Request) {
    this.logger.log(`B2C result callback from ${req.ip}`);
    this.logger.debug(body);
    return this.mpesaService.handleB2CResult(body);
  }

  @Post('b2c/timeout')
  @ApiOperation({ summary: 'Daraja B2C timeout callback' })
  async b2cTimeout(@Body() body: any, @Req() req: Request) {
    this.logger.log(`B2C timeout callback from ${req.ip}`);
    this.logger.debug(body);
    return this.mpesaService.handleB2CTimeout(body);
  }

  @Post('stk/callback')
  @ApiOperation({ summary: 'Daraja STK push callback' })
  async stkCallback(@Body() body: any, @Req() req: Request) {
    this.logger.log(`Daraja STK callback from ${req.ip}`);
    this.logger.debug(body);
    return this.mpesaService.handleStkCallback(body);
  }

  @Post('b2b/result')
  @ApiOperation({ summary: 'Daraja B2B result callback' })
  async b2bResult(@Body() body: any, @Req() req: Request) {
    this.logger.log(`B2B result callback from ${req.ip}`);
    this.logger.debug(body);
    return this.mpesaService.handleB2BResult(body);
  }

  @Post('b2b/timeout')
  @ApiOperation({ summary: 'Daraja B2B timeout callback' })
  async b2bTimeout(@Body() body: any, @Req() req: Request) {
    this.logger.log(`B2B timeout callback from ${req.ip}`);
    this.logger.debug(body);
    return this.mpesaService.handleB2BTimeout(body);
  }
}
