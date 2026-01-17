import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { PermissionModule } from 'src/auth/entities/permission.entity';
import { ResponseUtil } from 'src/common/utils/response.util';
import { CustomerGroupService } from './customer-group.service';
import { CreateCustomerGroupDto } from './dto/create-customer-group.dto';
import { UpdateCustomerGroupDto } from './dto/update-customer-group.dto';
import { CreateCustomerGroupMemberDto } from './dto/create-customer-group-member.dto';
import { UpdateCustomerGroupMemberDto } from './dto/update-customer-group-member.dto';
import { UpsertCustomerGroupEntitlementDto } from './dto/upsert-customer-group-entitlement.dto';

@Controller('customer-groups')
@ApiTags('Customer Groups')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomerGroupController {
  constructor(private readonly customerGroupService: CustomerGroupService) {}

  @Get()
  @RequirePermissions({
    module: PermissionModule.CUSTOMER_GROUPS,
    permission: 'read',
  })
  @ApiOkResponse({ description: 'Customer groups retrieved successfully' })
  async listGroups() {
    const data = await this.customerGroupService.listGroups();
    return ResponseUtil.success(data, 'Customer groups retrieved successfully');
  }

  @Post()
  @RequirePermissions({
    module: PermissionModule.CUSTOMER_GROUPS,
    permission: 'create',
  })
  @ApiOkResponse({ description: 'Customer group created successfully' })
  async createGroup(@Body() payload: CreateCustomerGroupDto) {
    const data = await this.customerGroupService.createGroup(payload);
    return ResponseUtil.success(data, 'Customer group created successfully');
  }

  @Patch(':code')
  @RequirePermissions({
    module: PermissionModule.CUSTOMER_GROUPS,
    permission: 'update',
  })
  @ApiOkResponse({ description: 'Customer group updated successfully' })
  async updateGroup(
    @Param('code') code: string,
    @Body() payload: UpdateCustomerGroupDto,
  ) {
    const data = await this.customerGroupService.updateGroup(code, payload);
    return ResponseUtil.success(data, 'Customer group updated successfully');
  }

  @Delete(':code')
  @RequirePermissions({
    module: PermissionModule.CUSTOMER_GROUPS,
    permission: 'delete',
  })
  @ApiOkResponse({ description: 'Customer group deleted successfully' })
  async deleteGroup(@Param('code') code: string) {
    await this.customerGroupService.deleteGroup(code);
    return ResponseUtil.success(null, 'Customer group deleted successfully');
  }

  @Get('members')
  @RequirePermissions({
    module: PermissionModule.CUSTOMER_GROUPS,
    permission: 'read',
  })
  @ApiOkResponse({ description: 'Customer group members retrieved successfully' })
  async listMembers(
    @Query('groupId') groupId?: string,
    @Query('memberType') memberType?: string,
    @Query('memberId') memberId?: string,
  ) {
    const data = await this.customerGroupService.listMembers({
      groupId,
      memberType,
      memberId,
    });
    return ResponseUtil.success(
      data,
      'Customer group members retrieved successfully',
    );
  }

  @Post('members')
  @RequirePermissions({
    module: PermissionModule.CUSTOMER_GROUPS,
    permission: 'create',
  })
  @ApiOkResponse({ description: 'Customer group member created successfully' })
  async createMember(@Body() payload: CreateCustomerGroupMemberDto) {
    const data = await this.customerGroupService.createMember(payload);
    return ResponseUtil.success(
      data,
      'Customer group member created successfully',
    );
  }

  @Patch('members/:id')
  @RequirePermissions({
    module: PermissionModule.CUSTOMER_GROUPS,
    permission: 'update',
  })
  @ApiOkResponse({ description: 'Customer group member updated successfully' })
  async updateMember(
    @Param('id') id: string,
    @Body() payload: UpdateCustomerGroupMemberDto,
  ) {
    const data = await this.customerGroupService.updateMember(id, payload);
    return ResponseUtil.success(
      data,
      'Customer group member updated successfully',
    );
  }

  @Delete('members/:id')
  @RequirePermissions({
    module: PermissionModule.CUSTOMER_GROUPS,
    permission: 'delete',
  })
  @ApiOkResponse({ description: 'Customer group member deleted successfully' })
  async deleteMember(@Param('id') id: string) {
    await this.customerGroupService.deleteMember(id);
    return ResponseUtil.success(
      null,
      'Customer group member deleted successfully',
    );
  }

  @Get('entitlements')
  @RequirePermissions({
    module: PermissionModule.CUSTOMER_GROUPS,
    permission: 'read',
  })
  @ApiOkResponse({ description: 'Customer group entitlements retrieved successfully' })
  async listEntitlements(@Query('groupId') groupId?: string) {
    const data = await this.customerGroupService.listEntitlements(groupId);
    return ResponseUtil.success(
      data,
      'Customer group entitlements retrieved successfully',
    );
  }

  @Post('entitlements')
  @RequirePermissions({
    module: PermissionModule.CUSTOMER_GROUPS,
    permission: 'update',
  })
  @ApiOkResponse({ description: 'Customer group entitlement upserted successfully' })
  async upsertEntitlement(@Body() payload: UpsertCustomerGroupEntitlementDto) {
    const data = await this.customerGroupService.upsertEntitlement(payload);
    return ResponseUtil.success(
      data,
      'Customer group entitlement upserted successfully',
    );
  }

  @Delete('entitlements/:id')
  @RequirePermissions({
    module: PermissionModule.CUSTOMER_GROUPS,
    permission: 'delete',
  })
  @ApiOkResponse({ description: 'Customer group entitlement deleted successfully' })
  async deleteEntitlement(@Param('id') id: string) {
    await this.customerGroupService.deleteEntitlement(id);
    return ResponseUtil.success(
      null,
      'Customer group entitlement deleted successfully',
    );
  }
}
