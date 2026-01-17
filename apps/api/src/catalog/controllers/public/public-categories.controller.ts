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
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';
import { ResponseUtil } from 'src/common/utils/response.util';
import { CategoryService } from '../../services/category.service';
import { ProductService } from '../../services/product.service';
import { PublicListCategoriesDto } from '../../dto/public/public-list-categories.dto';
import { PublicListProductsDto } from '../../dto/public/public-list-products.dto';
import { PublicListProductsViewDto } from '../../dto/public/public-list-products-view.dto';
import { CustomerGroupMembershipService } from 'src/customer-group/membership/customer-group-membership.service';

@Controller('public/catalog/categories')
@ApiTags('Public Catalog: Categories')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PublicCategoriesController {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly productService: ProductService,
    private readonly customerGroupMembershipService: CustomerGroupMembershipService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Public categories retrieved successfully' })
  async list(@Query() query: PublicListCategoriesDto) {
    const rows = await this.categoryService.findAllPublic(query);
    return ResponseUtil.success(
      rows,
      'Public categories retrieved successfully',
    );
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Public category retrieved successfully' })
  async get(@Param('id') id: string, @Query('locale') locale?: string) {
    const row = await this.categoryService.findOnePublic(id, { locale });
    return ResponseUtil.success(row, 'Public category retrieved successfully');
  }

  @Get(':id/products')
  @ApiOkResponse({ description: 'Public category products retrieved successfully' })
  async listCategoryProducts(
    @Param('id') id: string,
    @Query() query: PublicListProductsDto,
  ) {
    const result = await this.productService.findAllPublic({
      ...query,
      categoryId: id,
    });

    return ResponseUtil.paginated(
      result.data,
      result.total,
      result.page,
      result.limit,
      'Public category products retrieved successfully',
    );
  }

  @Get(':id/products/view')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({
    description: 'Public category product views retrieved successfully',
  })
  async listCategoryProductViews(
    @Req() req: Request,
    @Param('id') id: string,
    @Query() query: PublicListProductsViewDto,
  ) {
    const user = (req as any).user as { id: string } | undefined;
    const resolvedGroup = user?.id
      ? await this.customerGroupMembershipService.resolvePrimaryGroupForUser(user.id)
      : { groupCode: query.customerGroup, source: 'default' };

    const result = await this.productService.findAllPublicView({
      ...query,
      categoryId: id,
      channel: query.channel?.toUpperCase(),
      customerGroup: resolvedGroup.groupCode,
    });

    return ResponseUtil.paginated(
      result.data,
      result.total,
      result.page,
      result.limit,
      'Public category product views retrieved successfully',
    );
  }
}
