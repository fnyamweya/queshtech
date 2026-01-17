import { Controller, Get, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseUtil } from 'src/common/utils/response.util';
import { AlgoliaCatalogService } from '../../services/algolia-catalog.service';
import { PublicAlgoliaProductSearchDto } from '../../dto/public/public-algolia-product-search.dto';

@Controller('public/catalog/search')
@ApiTags('Public Catalog: Search')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PublicSearchController {
  constructor(private readonly algoliaCatalogService: AlgoliaCatalogService) {}

  @Get('config')
  @ApiOkResponse({ description: 'Public catalog search config retrieved successfully' })
  async config() {
    const cfg = await this.algoliaCatalogService.getPublicSearchConfig();
    return ResponseUtil.success(cfg, 'Public catalog search config retrieved successfully');
  }

  @Get('products')
  @ApiOperation({ summary: 'Search public catalog products via Algolia' })
  @ApiOkResponse({ description: 'Public catalog search results retrieved successfully' })
  async searchProducts(@Query() query: PublicAlgoliaProductSearchDto) {
    const result = await this.algoliaCatalogService.searchPublicProducts({
      q: query.q,
      page: query.page,
      limit: query.limit,
      filters: query.filters,
    });

    return ResponseUtil.success(
      result ?? { skipped: true },
      result ? 'Public catalog search results retrieved successfully' : 'Algolia not configured; skipped',
    );
  }
}
