import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ResponseUtil } from 'src/common/utils/response.util';
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';
import { ProductService } from '../../services/product.service';
import { PublicListProductsDto } from '../../dto/public/public-list-products.dto';
import { PublicListProductsViewDto } from '../../dto/public/public-list-products-view.dto';
import { PublicProductViewQueryDto } from '../../dto/public/public-product-view-query.dto';
import { CustomerGroupMembershipService } from 'src/customer-group/membership/customer-group-membership.service';
import { CustomerProductViewService } from '../../services/customer-product-view.service';

@Controller('public/catalog/products')
@ApiTags('Public Catalog: Products')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PublicProductsController {
  constructor(
    private readonly productService: ProductService,
    private readonly customerGroupMembershipService: CustomerGroupMembershipService,
    private readonly customerProductViewService: CustomerProductViewService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Public products retrieved successfully' })
  async list(@Query() query: PublicListProductsDto) {
    const result = await this.productService.findAllPublic(query);
    return ResponseUtil.paginated(
      result.data,
      result.total,
      result.page,
      result.limit,
      'Public products retrieved successfully',
    );
  }

  @Get('view')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ description: 'Public product views retrieved successfully' })
  async listView(
    @Req() req: Request,
    @Query() query: PublicListProductsViewDto,
  ) {
    const user = (req as any).user as { id: string } | undefined;
    const resolvedGroup = user?.id
      ? await this.customerGroupMembershipService.resolvePrimaryGroupForUser(user.id)
      : { groupCode: query.customerGroup, source: 'default' };

    const result = await this.productService.findAllPublicView({
      ...query,
      channel: query.channel?.toUpperCase(),
      customerGroup: resolvedGroup.groupCode,
    });
    return ResponseUtil.paginated(
      result.data,
      result.total,
      result.page,
      result.limit,
      'Public product views retrieved successfully',
    );
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Public product retrieved successfully' })
  async get(
    @Param('id') id: string,
    @Query('locale') locale?: string,
    @Query('priceListId') priceListId?: string,
    @Query('currencyCode') currencyCode?: string,
  ) {
    const product = await this.productService.findOnePublic(id, {
      locale,
      priceListId,
      currencyCode,
    });
    return ResponseUtil.success(
      product,
      'Public product retrieved successfully',
    );
  }

  @Get(':id/view')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ description: 'Public product view retrieved successfully' })
  async getView(
    @Req() req: Request,
    @Param('id') id: string,
    @Query() query: PublicProductViewQueryDto,
  ) {
    const user = (req as any).user as { id: string } | undefined;

    if (user?.id) {
      await this.customerProductViewService.recordView(user.id, id);
    }
    const resolvedGroup = user?.id
      ? await this.customerGroupMembershipService.resolvePrimaryGroupForUser(user.id)
      : { groupCode: query.customerGroup, source: 'default' };

    const context = {
      channel: query.channel?.toUpperCase(),
      customerGroup: resolvedGroup.groupCode,
      location: query.location,
      role: query.role,
    };
    const product = await this.productService.findOnePublicView(id, {
      locale: query.locale,
      priceListId: query.priceListId,
      currencyCode: query.currencyCode,
      context,
    });
    return ResponseUtil.success(
      product,
      'Public product view retrieved successfully',
    );
  }
}
