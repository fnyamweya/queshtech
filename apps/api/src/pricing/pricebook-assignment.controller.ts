import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { PermissionModule } from 'src/auth/entities/permission.entity';
import { ResponseUtil } from 'src/common/utils/response.util';
import { PricebookAssignmentService } from './pricebook-assignment.service';
import {
  CreatePricebookAssignmentDto,
  UpdatePricebookAssignmentDto,
  SetDefaultAssignmentDto,
} from './dto';

@Controller('pricebook-assignments')
@ApiTags('Pricebook Assignments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PricebookAssignmentController {
  constructor(private readonly assignmentService: PricebookAssignmentService) {}

  @Post()
  @RequirePermissions({ module: PermissionModule.PRICING, permission: 'create' })
  @ApiOperation({ summary: 'Create a new pricebook assignment' })
  @ApiCreatedResponse({ description: 'Assignment created' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async create(@Body() dto: CreatePricebookAssignmentDto) {
    const assignment = await this.assignmentService.createAssignment(dto);
    return ResponseUtil.created({ assignment }, 'Assignment created');
  }

  @Get()
  @RequirePermissions({ module: PermissionModule.PRICING, permission: 'read' })
  @ApiOperation({ summary: 'List pricebook assignments' })
  @ApiQuery({ name: 'pricebookId', required: false })
  @ApiQuery({ name: 'channelId', required: false })
  @ApiQuery({ name: 'customerGroupId', required: false })
  @ApiQuery({ name: 'countryCode', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Assignments retrieved' })
  async list(
    @Query('pricebookId') pricebookId?: string,
    @Query('channelId') channelId?: string,
    @Query('customerGroupId') customerGroupId?: string,
    @Query('countryCode') countryCode?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.assignmentService.listAssignments({
      pricebookId,
      channelId,
      customerGroupId,
      countryCode,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return ResponseUtil.paginated(
      result.data,
      result.total,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      'Assignments retrieved',
    );
  }

  @Get('default')
  @RequirePermissions({ module: PermissionModule.PRICING, permission: 'read' })
  @ApiOperation({ summary: 'Get the default assignment' })
  @ApiOkResponse({ description: 'Default assignment retrieved' })
  async getDefault() {
    const assignment = await this.assignmentService.getDefaultAssignment();
    return ResponseUtil.success({ assignment }, 'Default assignment retrieved');
  }

  @Put('default')
  @RequirePermissions({ module: PermissionModule.PRICING, permission: 'update' })
  @ApiOperation({ summary: 'Set the default assignment (single-channel convenience)' })
  @ApiBody({ type: SetDefaultAssignmentDto })
  @ApiOkResponse({ description: 'Default assignment set' })
  async setDefault(@Body() dto: SetDefaultAssignmentDto) {
    const assignment = await this.assignmentService.setDefaultAssignment(dto);
    return ResponseUtil.success({ assignment }, 'Default assignment set');
  }

  @Get(':id')
  @RequirePermissions({ module: PermissionModule.PRICING, permission: 'read' })
  @ApiOperation({ summary: 'Get an assignment by ID' })
  @ApiParam({ name: 'id', description: 'Assignment UUID' })
  @ApiOkResponse({ description: 'Assignment retrieved' })
  async get(@Param('id') id: string) {
    const assignment = await this.assignmentService.getAssignment(id);
    return ResponseUtil.success({ assignment }, 'Assignment retrieved');
  }

  @Patch(':id')
  @RequirePermissions({ module: PermissionModule.PRICING, permission: 'update' })
  @ApiOperation({ summary: 'Update an assignment' })
  @ApiParam({ name: 'id', description: 'Assignment UUID' })
  @ApiOkResponse({ description: 'Assignment updated' })
  async update(@Param('id') id: string, @Body() dto: UpdatePricebookAssignmentDto) {
    const assignment = await this.assignmentService.updateAssignment(id, dto);
    return ResponseUtil.success({ assignment }, 'Assignment updated');
  }

  @Delete(':id')
  @RequirePermissions({ module: PermissionModule.PRICING, permission: 'delete' })
  @ApiOperation({ summary: 'Delete an assignment' })
  @ApiParam({ name: 'id', description: 'Assignment UUID' })
  @ApiOkResponse({ description: 'Assignment deleted' })
  async delete(@Param('id') id: string) {
    const result = await this.assignmentService.deleteAssignment(id);
    return ResponseUtil.success(result, 'Assignment deleted');
  }
}
