import {
  Controller,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { PermissionModule } from 'src/auth/entities/permission.entity';
import { ResponseUtil } from 'src/common/utils/response.util';
import { AlgoliaCatalogService } from '../services/algolia-catalog.service';

@Controller('catalog/search')
@ApiTags('Catalog: Search')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('access-token')
export class CatalogSearchController {
  constructor(private readonly algoliaCatalogService: AlgoliaCatalogService) {}

  @Post('algolia/test')
  @RequirePermissions({ module: PermissionModule.SETTINGS, permission: 'read' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test Algolia connection for catalog search' })
  @ApiOkResponse({ description: 'Algolia connection test result' })
  async test() {
    const result = await this.algoliaCatalogService.testConnection();
    return ResponseUtil.success(result, 'Algolia connection test completed');
  }

  @Post('algolia/apply-settings')
  @RequirePermissions({ module: PermissionModule.SETTINGS, permission: 'update' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply Algolia index settings (setSettings) for catalog products index' })
  @ApiOkResponse({ description: 'Algolia index settings applied' })
  async applySettings() {
    const result = await this.algoliaCatalogService.applyIndexSettings();
    return ResponseUtil.success(
      result ?? { skipped: true },
      result ? 'Algolia index settings applied' : 'Algolia not configured; skipped',
    );
  }

  @Post('algolia/reindex')
  @RequirePermissions({ module: PermissionModule.SETTINGS, permission: 'update' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reindex all catalog products into Algolia' })
  @ApiOkResponse({ description: 'Catalog reindex completed' })
  async reindexAll() {
    const result = await this.algoliaCatalogService.reindexAll();
    return ResponseUtil.success(
      result ?? { skipped: true },
      result ? 'Catalog reindex completed' : 'Algolia not configured; skipped',
    );
  }

  @Post('algolia/products/:id/index')
  @RequirePermissions({ module: PermissionModule.SETTINGS, permission: 'update' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Index one product into Algolia' })
  async indexOne(@Param('id') id: string) {
    await this.algoliaCatalogService.indexProduct(id);
    return ResponseUtil.success({ ok: true }, 'Product indexed');
  }

  @Post('algolia/products/:id/delete')
  @RequirePermissions({ module: PermissionModule.SETTINGS, permission: 'update' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete one product object from Algolia' })
  async deleteOne(@Param('id') id: string) {
    await this.algoliaCatalogService.deleteProduct(id);
    return ResponseUtil.success({ ok: true }, 'Product removed from Algolia');
  }
}
