import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ResponseUtil } from 'src/common/utils/response.util';
import { AlgoliaCatalogService } from '../../services/algolia-catalog.service';

@Controller('public/catalog/search')
@ApiTags('Public Catalog: Search')
export class PublicSearchController {
  constructor(private readonly algoliaCatalogService: AlgoliaCatalogService) {}

  @Get('config')
  @ApiOkResponse({ description: 'Public catalog search config retrieved successfully' })
  async config() {
    const cfg = await this.algoliaCatalogService.getPublicSearchConfig();
    return ResponseUtil.success(cfg, 'Public catalog search config retrieved successfully');
  }
}
