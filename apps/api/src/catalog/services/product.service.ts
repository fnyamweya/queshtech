import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  DeepPartial,
  EntityManager,
  In,
  IsNull,
  Not,
  Repository,
} from 'typeorm';
import { randomBytes } from 'crypto';
import { Product } from '../entities/product.entity';
import { Brand } from '../entities/brand.entity';
import { ProductSku } from '../entities/product-sku.entity';
import { ProductCategory } from '../entities/product-category.entity';
import { ProductChannel } from '../entities/product-channel.entity';
import { ProductContextOverride } from '../entities/product-context-override.entity';
import { PriceList } from '../entities/price-list.entity';
import { Currency } from '../entities/currency.entity';
import { PriceRow } from '../entities/price-row.entity';
import { Category } from '../entities/category.entity';
import { Channel } from 'src/channels/entities/channel.entity';
import { CreateProductDto, ProductStatus } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { FilterProductDto } from '../dto/filter-product.dto';
import { PublicListProductsDto } from '../dto/public/public-list-products.dto';
import { PublicListProductsViewDto } from '../dto/public/public-list-products-view.dto';
import { PublicCategoryDto } from '../dto/public/public-category.dto';
import {
  PublicProductCategoryRefDto,
  PublicProductDto,
  PublicProductPriceDto,
  PublicProductSkuDto,
} from '../dto/public/public-product.dto';
import { AppCacheService } from 'src/common/cache/app-cache.service';
import {
  cacheKeyFromParts,
  cacheKeyHash,
} from 'src/common/cache/cache-key.util';
import { ShippingCatalogContextCacheIndexService } from 'src/common/cache/shipping-catalog-context-cache-index.service';
import { PriceResolveCacheIndexService } from 'src/common/cache/price-resolve-cache-index.service';
import { ProductAvailabilityDto } from '../dto/product-availability.dto';
import { CreateProductSkuDto } from '../dto/create-product-sku.dto';
import { CreateProductPriceDto } from '../dto/create-product-price.dto';
import { CreateProductContextOverrideDto } from '../dto/product-v2/create-product-context-override.dto';
import { UpdateProductContextOverrideDto } from '../dto/product-v2/update-product-context-override.dto';
import { ProductDTO, ProductViewDTO } from '../dto/product-v2/product.dto';
import {
  ContextualOverrideDTO,
  LocalizedString,
} from '../dto/product-v2/product.types';
import {
  applyContextualOverrides,
  ProductViewContext,
} from '../utils/contextual-overrides.util';
import { PriceService } from './price.service';
import { CurrencyService } from 'src/currency/currency.service';

interface PaginatedProducts {
  data: Product[];
  total: number;
  page: number;
  limit: number;
}

interface AvailabilityNormalized {
  // Make this structurally assignable to jsonb records.
  [key: string]: any;
  channels: string[];
  countries: string[];
  locations: string[];
  stock: {
    type: string;
    quantity?: number;
  };
  schedule: {
    startAt?: string;
    endAt?: string;
  };
  meta?: Record<string, unknown>;
}

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
    @InjectRepository(ProductSku)
    private readonly skuRepository: Repository<ProductSku>,
    @InjectRepository(ProductCategory)
    private readonly productCategoryRepository: Repository<ProductCategory>,
    @InjectRepository(ProductChannel)
    private readonly productChannelRepository: Repository<ProductChannel>,
    @InjectRepository(ProductContextOverride)
    private readonly productContextOverrideRepository: Repository<ProductContextOverride>,
    @InjectRepository(PriceRow)
    private readonly priceRowRepository: Repository<PriceRow>,
    @InjectRepository(PriceList)
    private readonly priceListRepository: Repository<PriceList>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly cache: AppCacheService,
    private readonly shippingCatalogContextCacheIndex: ShippingCatalogContextCacheIndexService,
    private readonly priceResolveCacheIndex: PriceResolveCacheIndexService,
    private readonly priceService: PriceService,
    private readonly currencyService: CurrencyService,
  ) {}

  private async normalizeAndValidateCurrencyCode(
    currencyCode?: string,
  ): Promise<string | undefined> {
    if (!currencyCode) return undefined;
    return this.currencyService.assertExists(currencyCode);
  }

  private getRepos(manager?: EntityManager) {
    if (!manager) {
      return {
        productRepository: this.productRepository,
        brandRepository: this.brandRepository,
        skuRepository: this.skuRepository,
        productCategoryRepository: this.productCategoryRepository,
        productChannelRepository: this.productChannelRepository,
        productContextOverrideRepository: this.productContextOverrideRepository,
        priceRowRepository: this.priceRowRepository,
        priceListRepository: this.priceListRepository,
        currencyRepository: this.currencyRepository,
        categoryRepository: this.categoryRepository,
        channelRepository: this.channelRepository,
      };
    }

    return {
      productRepository: manager.getRepository(Product),
      brandRepository: manager.getRepository(Brand),
      skuRepository: manager.getRepository(ProductSku),
      productCategoryRepository: manager.getRepository(ProductCategory),
      productChannelRepository: manager.getRepository(ProductChannel),
      productContextOverrideRepository: manager.getRepository(
        ProductContextOverride,
      ),
      priceRowRepository: manager.getRepository(PriceRow),
      priceListRepository: manager.getRepository(PriceList),
      currencyRepository: manager.getRepository(Currency),
      categoryRepository: manager.getRepository(Category),
      channelRepository: manager.getRepository(Channel),
    };
  }

  private toMinorUnits(value: number, precision: number) {
    const p = Math.max(0, precision ?? 2);
    const fixed = Number(value).toFixed(p);
    const negative = fixed.startsWith('-');
    const normalized = negative ? fixed.slice(1) : fixed;
    const parts = normalized.split('.');
    const intPart = parts[0] ?? '0';
    const fracPart = (parts[1] ?? '').padEnd(p, '0');
    const digits = `${intPart}${p ? fracPart : ''}`.replace(/^0+(?=\d)/, '0');
    return `${negative ? '-' : ''}${digits}`;
  }

  private fromMinorUnits(amount: string, precision: number) {
    const p = Math.max(0, precision ?? 2);
    const negative = String(amount).startsWith('-');
    const digits = negative ? String(amount).slice(1) : String(amount);
    const padded = digits.padStart(p + 1, '0');
    const intPart = padded.slice(0, padded.length - p);
    const fracPart = padded.slice(padded.length - p);
    const normalizedInt = intPart.replace(/^0+(?=\d)/, '0');
    const value = p === 0 ? normalizedInt : `${normalizedInt}.${fracPart}`;
    return negative ? `-${value}` : value;
  }

  async create(payload: CreateProductDto): Promise<Product> {
    const productId = await this.dataSource.transaction(async (manager) => {
      const { brandRepository, productRepository } = this.getRepos(manager);

      if (payload.brandId) {
        const exists = await brandRepository.exist({
          where: { id: payload.brandId },
        });
        if (!exists) throw new NotFoundException('Brand not found');
      }

      const slug = await this.generateUniqueProductSlug(payload.title, undefined, manager);

      const product = productRepository.create({
        title: payload.title,
        description: payload.description,
        seoTitle: payload.seoTitle,
        seoDescription: payload.seoDescription,
        status: payload.status ?? ProductStatus.DRAFT,
        slug,
        externalRef: payload.externalRef,
        brandId: payload.brandId,
        optionDefinitionsJson: (payload.optionDefinitions ?? []) as any,
        metaJson: payload.metaJson ?? {},
      });

      const saved = await productRepository.save(product);

      const { skus, inputs, channels } = await this.persistSkus(
        saved.id,
        saved.slug,
        saved.title,
        payload.skus,
        payload.optionDefinitions ?? [],
        manager,
      );

      const inputsWithIds = (inputs ?? []).map((input, index) => {
        const sku = skus?.[index];
        return {
          ...(input as any),
          id: sku?.id,
          sku: (input as any)?.sku ?? (sku as any)?.sku,
        } as any;
      });

      await this.persistPrices(
        saved.id,
        (payload as any).prices,
        skus,
        inputsWithIds,
        manager,
      );

      if (payload.categoryIds?.length) {
        await this.attachCategories(saved.id, payload.categoryIds, manager);
      }

      await this.syncChannels(saved.id, channels, manager);
      return saved.id;
    });

    await this.clearProductCaches(productId);
    return this.findOne(productId);
  }

  async findAll(filters: FilterProductDto): Promise<PaginatedProducts> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;

    const rawKey = cacheKeyFromParts('catalog', 'products', 'list', {
      page,
      limit,
      status: filters.status,
      brandId: filters.brandId,
      categoryId: filters.categoryId,
      search: filters.search,
    });
    const key = `catalog:products:list:${cacheKeyHash(rawKey)}`;

    return this.cache.remember(
      key,
      async () => {
        const qb = this.productRepository
          .createQueryBuilder('product')
          .leftJoinAndSelect('product.brand', 'brand')
          .leftJoinAndSelect('product.skus', 'skus')
          .leftJoinAndSelect('product.productCategories', 'productCategories')
          .leftJoinAndSelect('productCategories.category', 'category')
          .orderBy('product.createdAt', 'DESC')
          .skip((page - 1) * limit)
          .take(limit);

        if (filters.status) {
          qb.andWhere('product.status = :status', { status: filters.status });
        }

        if (filters.brandId) {
          qb.andWhere('product.brand_id = :brandId', {
            brandId: filters.brandId,
          });
        }

        if (filters.categoryId) {
          qb.andWhere('productCategories.categoryId = :categoryId', {
            categoryId: filters.categoryId,
          });
        }

        if (filters.search) {
          qb.andWhere(
            new Brackets((qbInner) => {
              qbInner
                .where('product.title ILIKE :search', {
                  search: `%${filters.search}%`,
                })
                .orWhere('product.slug ILIKE :search', {
                  search: `%${filters.search}%`,
                });
            }),
          );
        }

        const [data, total] = await qb.getManyAndCount();

        await this.attachSkuPrices(data);
        return { data, total, page, limit };
      },
      { ttlSeconds: 45 },
    );
  }

  async findOne(id: string): Promise<Product> {
    const key = `catalog:products:${id}`;
    const product = await this.cache.remember(
      key,
      () =>
        this.productRepository.findOne({
          where: { id },
          relations: [
            'brand',
            'skus',
            'productCategories',
            'productCategories.category',
            'productChannels',
            'productChannels.channel',
          ],
        }),
      { ttlSeconds: 180 },
    );

    if (!product) throw new NotFoundException('Product not found');

    await this.attachSkuPrices([product]);
    return product;
  }

  async update(id: string, payload: UpdateProductDto): Promise<Product> {
    const product = await this.findOneEntityOrThrow(id);

    if (payload.brandId) {
      const exists = await this.brandRepository.exist({
        where: { id: payload.brandId },
      });
      if (!exists) throw new NotFoundException('Brand not found');
    }

    let slug = product.slug;
    if (payload.title && payload.title !== product.title) {
      slug = await this.generateUniqueProductSlug(payload.title, product.id);
    }

    Object.assign(product, {
      title: payload.title ?? product.title,
      description: payload.description ?? product.description,
      seoTitle: payload.seoTitle ?? product.seoTitle,
      seoDescription: payload.seoDescription ?? product.seoDescription,
      status: payload.status ?? product.status,
      slug,
      externalRef: payload.externalRef ?? product.externalRef,
      brandId: payload.brandId ?? product.brandId,
      optionDefinitionsJson:
        payload.optionDefinitions !== undefined
          ? ((payload.optionDefinitions ?? []) as any)
          : product.optionDefinitionsJson,
      metaJson: payload.metaJson ?? product.metaJson,
    });

    const saved = await this.productRepository.save(product);

    const skuInputs = (payload as any).skus as CreateProductSkuDto[] | undefined;
    const skusMode: 'replace' | 'patch' = payload.skusMode ?? 'replace';
    let affectedSkuIds: string[] = [];

    if (skuInputs) {
      await this.dataSource.transaction(async (manager) => {
        const { skuRepository, priceRowRepository } = this.getRepos(manager);

        const optionDefs = (payload.optionDefinitions ??
          (saved.optionDefinitionsJson as any) ??
          []) as any[];

        const {
          skus: finalSkus,
          deletedSkuIds,
          touchedSkuIds,
          channels,
          shouldSyncChannels,
        } = await this.upsertSkus(
          saved.id,
          saved.slug,
          saved.title,
          skuInputs,
          optionDefs,
          skusMode,
          manager,
        );

        // Clean up prices for removed SKUs only.
        if (deletedSkuIds.length) {
          await priceRowRepository.delete({
            targetType: 'SKU' as any,
            targetId: In(deletedSkuIds),
          });
        }

        // Only touch price rows for SKUs whose payload explicitly included prices.
        const inputsWithPrices = (skuInputs ?? []).filter((s) =>
          Object.prototype.hasOwnProperty.call(s as any, 'prices'),
        );
        if (inputsWithPrices.length) {
          await this.persistPrices(
            saved.id,
            (payload as any).prices,
            finalSkus,
            inputsWithPrices,
            manager,
          );
        }

        if (shouldSyncChannels) {
          await this.syncChannels(saved.id, channels, manager);
        }

        affectedSkuIds = Array.from(
          new Set([...touchedSkuIds, ...deletedSkuIds]),
        );
      });
    }

    if (payload.categoryIds) {
      await this.productCategoryRepository.delete({ productId: saved.id });
      if (payload.categoryIds.length) {
        await this.attachCategories(saved.id, payload.categoryIds);
      }
    }


    await this.clearProductCaches(saved.id, affectedSkuIds);
    return this.findOne(saved.id);
  }

  private async attachSkuPrices(products: Product[]) {
    const skuEntities = products.flatMap((p) => p.skus ?? []);
    const skuIds = skuEntities.map((s) => s.id).filter(Boolean);
    if (!skuIds.length) return;

    const rows = await this.priceRowRepository.find({
      where: { targetType: 'SKU' as any, targetId: In(skuIds) },
      order: { createdAt: 'DESC' },
    });

    if (!rows.length) {
      for (const s of skuEntities) (s as any).prices = [];
      return;
    }

    const priceListIds = Array.from(new Set(rows.map((r) => r.priceListId)));
    const lists = await this.priceListRepository.find({
      where: { id: In(priceListIds) },
    });
    const listById = new Map(lists.map((l) => [l.id, l] as const));

    const currencyCodes = Array.from(new Set(lists.map((l) => l.currency)));
    const currencies = currencyCodes.length
      ? await this.currencyRepository.find({
          where: { code: In(currencyCodes) },
        })
      : [];
    const precisionByCode = new Map(
      currencies.map((c) => [c.code, c.precision] as const),
    );

    const bySkuId = new Map<string, any[]>();
    for (const r of rows) {
      const list = listById.get(r.priceListId);
      const precision = precisionByCode.get(list?.currency ?? '') ?? 2;
      const unitPrice = Number(this.fromMinorUnits(r.unitAmount, precision));
      const compareAtPrice = r.compareAtAmount
        ? Number(this.fromMinorUnits(r.compareAtAmount, precision))
        : undefined;

      const dto = {
        id: r.id,
        priceListId: r.priceListId,
        unitPrice,
        compareAtPrice,
        minQuantity: r.minQuantity ?? undefined,
        maxQuantity: r.maxQuantity ?? undefined,
        validFrom: r.validFrom ? r.validFrom.toISOString() : undefined,
        validTo: r.validTo ? r.validTo.toISOString() : undefined,
        metaJson: r.metaJson ?? {},
      };

      const listForSku = bySkuId.get(r.targetId);
      if (listForSku) listForSku.push(dto);
      else bySkuId.set(r.targetId, [dto]);
    }

    for (const s of skuEntities) {
      (s as any).prices = bySkuId.get(s.id) ?? [];
    }
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOneEntityOrThrow(id);
    await this.productRepository.remove(product);

    await this.clearProductCaches(id);
  }

  async findAllPublic(filters: PublicListProductsDto): Promise<{
    data: PublicProductDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;

    const currencyCode = await this.normalizeAndValidateCurrencyCode(
      filters.currencyCode,
    );

    const rawKey = cacheKeyFromParts('public', 'catalog', 'products', 'list', {
      page,
      limit,
      search: filters.search,
      brandId: filters.brandId,
      categoryId: filters.categoryId,
      taxonomyId: filters.taxonomyId,
      channel: filters.channel,
      country: filters.country,
      location: filters.location,
      locale: filters.locale,
      priceListId: filters.priceListId,
      currencyCode,
    });
    const key = `public:catalog:products:list:${cacheKeyHash(rawKey)}`;

    return this.cache.remember(
      key,
      async () => {
        const qb = this.productRepository
          .createQueryBuilder('product')
          .leftJoinAndSelect('product.brand', 'brand')
          .leftJoinAndSelect('product.skus', 'skus')
          .leftJoinAndSelect('product.productCategories', 'productCategories')
          .leftJoinAndSelect('productCategories.category', 'category')
          .where('product.status = :status', { status: ProductStatus.ACTIVE });

        if (filters.brandId) {
          qb.andWhere('product.brand_id = :brandId', {
            brandId: filters.brandId,
          });
        }

        if (filters.categoryId) {
          qb.andWhere('productCategories.categoryId = :categoryId', {
            categoryId: filters.categoryId,
          });
        }

        if (filters.taxonomyId) {
          qb.andWhere('category.taxonomyId = :taxonomyId', {
            taxonomyId: filters.taxonomyId,
          });
        }

        if (filters.search) {
          qb.andWhere(
            new Brackets((qbInner) => {
              qbInner
                .where('product.title ILIKE :search', {
                  search: `%${filters.search}%`,
                })
                .orWhere('product.slug ILIKE :search', {
                  search: `%${filters.search}%`,
                });
            }),
          );
        }

        if (filters.channel) {
          qb.leftJoin('product.productChannels', 'productChannels')
            .leftJoin('productChannels.channel', 'channel')
            .andWhere('channel.code = :channel', {
              channel: filters.channel.toUpperCase(),
            });
        }

        if (filters.country) {
          const country = filters.country.toUpperCase();
          qb.andWhere("skus.availability -> 'countries' ? :country", {
            country,
          });
        }

        if (filters.location) {
          qb.andWhere("skus.availability -> 'locations' ? :location", {
            location: filters.location.toLowerCase(),
          });
        }

        qb.orderBy('product.createdAt', 'DESC')
          .skip((page - 1) * limit)
          .take(limit);

        const [rows, total] = await qb.getManyAndCount();
        const data = await Promise.all(
          rows.map((row) =>
            this.toPublicProduct(row, {
              locale: filters.locale,
              includeSkus: false,
              priceListId: filters.priceListId,
              currencyCode,
            }),
          ),
        );

        return { data, total, page, limit };
      },
      { ttlSeconds: 45 },
    );
  }

  async findOnePublic(
    id: string,
    opts?: { locale?: string; priceListId?: string; currencyCode?: string },
  ): Promise<PublicProductDto> {
    const currencyCode = await this.normalizeAndValidateCurrencyCode(
      opts?.currencyCode,
    );
    const rawKey = cacheKeyFromParts('public', 'catalog', 'products', 'one', {
      id,
      locale: opts?.locale,
      priceListId: opts?.priceListId,
      currencyCode,
    });
    const key = `public:catalog:products:${cacheKeyHash(rawKey)}`;

    const product = await this.cache.remember(
      key,
      () =>
        this.productRepository.findOne({
          where: { id, status: ProductStatus.ACTIVE },
          relations: [
            'brand',
            'skus',
            'productCategories',
            'productCategories.category',
            'productChannels',
            'productChannels.channel',
          ],
        }),
      { ttlSeconds: 180 },
    );

    if (!product) throw new NotFoundException('Product not found');
    return this.toPublicProduct(product, {
      locale: opts?.locale,
      includeSkus: true,
      priceListId: opts?.priceListId,
      currencyCode,
    });
  }

  async findAllPublicView(filters: PublicListProductsViewDto): Promise<{
    data: ProductViewDTO[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const context = this.buildViewContext(filters);

    const rawKey = cacheKeyFromParts(
      'public',
      'catalog',
      'products',
      'view',
      'list',
      {
        page,
        limit,
        search: filters.search,
        brandId: filters.brandId,
        categoryId: filters.categoryId,
        taxonomyId: filters.taxonomyId,
        channel: filters.channel,
        country: filters.country,
        location: filters.location,
        locale: filters.locale,
        priceListId: filters.priceListId,
        currencyCode: filters.currencyCode,
        customerGroup: filters.customerGroup,
        role: filters.role,
        context,
      },
    );
    const key = `public:catalog:products:view:list:${cacheKeyHash(rawKey)}`;

    return this.cache.remember(
      key,
      async () => {
        const qb = this.productRepository
          .createQueryBuilder('product')
          .leftJoinAndSelect('product.brand', 'brand')
          .leftJoinAndSelect('product.skus', 'skus')
          .leftJoinAndSelect('product.productCategories', 'productCategories')
          .leftJoinAndSelect('productCategories.category', 'category')
          .where('product.status = :status', { status: ProductStatus.ACTIVE });

        if (filters.brandId) {
          qb.andWhere('product.brand_id = :brandId', {
            brandId: filters.brandId,
          });
        }

        if (filters.categoryId) {
          qb.andWhere('productCategories.categoryId = :categoryId', {
            categoryId: filters.categoryId,
          });
        }

        if (filters.taxonomyId) {
          qb.andWhere('category.taxonomyId = :taxonomyId', {
            taxonomyId: filters.taxonomyId,
          });
        }

        if (filters.search) {
          qb.andWhere(
            new Brackets((qbInner) => {
              qbInner
                .where('product.title ILIKE :search', {
                  search: `%${filters.search}%`,
                })
                .orWhere('product.slug ILIKE :search', {
                  search: `%${filters.search}%`,
                });
            }),
          );
        }

        if (filters.channel) {
          qb.leftJoin('product.productChannels', 'productChannels')
            .leftJoin('productChannels.channel', 'channel')
            .andWhere('channel.code = :channel', {
              channel: filters.channel.toUpperCase(),
            });
        }

        if (filters.country) {
          const country = filters.country.toUpperCase();
          qb.andWhere("skus.availability -> 'countries' ? :country", {
            country,
          });
        }

        if (filters.location) {
          qb.andWhere("skus.availability -> 'locations' ? :location", {
            location: filters.location.toLowerCase(),
          });
        }

        qb.orderBy('product.createdAt', 'DESC')
          .skip((page - 1) * limit)
          .take(limit);

        const [rows, total] = await qb.getManyAndCount();
        const overridesByProduct = await this.loadContextOverridesByProductIds(
          rows.map((row) => row.id),
        );

        const data = await Promise.all(
          rows.map((row) =>
            this.toProductView(row, overridesByProduct.get(row.id), {
              locale: filters.locale,
              priceListId: filters.priceListId,
              currencyCode: filters.currencyCode,
              context,
            }),
          ),
        );

        return { data, total, page, limit };
      },
      { ttlSeconds: 45 },
    );
  }

  async findOnePublicView(
    id: string,
    opts?: {
      locale?: string;
      priceListId?: string;
      currencyCode?: string;
      context?: ProductViewContext;
    },
  ): Promise<ProductViewDTO> {
    const rawKey = cacheKeyFromParts(
      'public',
      'catalog',
      'products',
      'view',
      'one',
      {
        id,
        locale: opts?.locale,
        priceListId: opts?.priceListId,
        currencyCode: opts?.currencyCode,
        context: opts?.context ?? null,
      },
    );
    const key = `public:catalog:products:view:${cacheKeyHash(rawKey)}`;

    return this.cache.remember(
      key,
      async () => {
        const product = await this.productRepository.findOne({
          where: { id, status: ProductStatus.ACTIVE },
          relations: [
            'brand',
            'skus',
            'productCategories',
            'productCategories.category',
            'productChannels',
            'productChannels.channel',
          ],
        });

        if (!product) throw new NotFoundException('Product not found');

        const overrides = await this.productContextOverrideRepository.find({
          where: { productId: product.id },
        });
        const overrideDtos = overrides.map((override) =>
          this.toContextualOverrideDto(override),
        );
        return this.toProductView(product, overrideDtos, {
          locale: opts?.locale,
          priceListId: opts?.priceListId,
          currencyCode: opts?.currencyCode,
          context: opts?.context,
        });
      },
      { ttlSeconds: 180 },
    );
  }

  async listContextOverrides(
    productId: string,
  ): Promise<ProductContextOverride[]> {
    await this.findOneEntityOrThrow(productId);
    return this.productContextOverrideRepository.find({
      where: { productId },
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async createContextOverride(
    productId: string,
    payload: CreateProductContextOverrideDto,
  ): Promise<ProductContextOverride> {
    await this.findOneEntityOrThrow(productId);
    const override = this.productContextOverrideRepository.create({
      productId,
      isActive: payload.isActive ?? true,
      priority: payload.priority ?? 0,
      validFrom: payload.validFrom ? new Date(payload.validFrom) : undefined,
      validUntil: payload.validUntil ? new Date(payload.validUntil) : undefined,
      matchContext: (payload.match ?? {}) as any,
      rule: (payload.rule ?? undefined) as any,
      patch: (payload.patch ?? []) as any,
      description: payload.description,
      audit: {},
    });

    const saved = await this.productContextOverrideRepository.save(override);
    await this.clearProductCaches(productId);
    return saved;
  }

  async updateContextOverride(
    productId: string,
    overrideId: string,
    payload: UpdateProductContextOverrideDto,
  ): Promise<ProductContextOverride> {
    const override = await this.productContextOverrideRepository.findOne({
      where: { id: overrideId, productId },
    });
    if (!override)
      throw new NotFoundException('Product context override not found');

    if (payload.isActive !== undefined) override.isActive = payload.isActive;
    if (payload.priority !== undefined) override.priority = payload.priority;
    if (payload.validFrom !== undefined)
      override.validFrom = payload.validFrom
        ? new Date(payload.validFrom)
        : undefined;
    if (payload.validUntil !== undefined)
      override.validUntil = payload.validUntil
        ? new Date(payload.validUntil)
        : undefined;
    if (payload.match !== undefined)
      override.matchContext = (payload.match ?? {}) as any;
    if (payload.rule !== undefined)
      override.rule = (payload.rule ?? undefined) as any;
    if (payload.patch !== undefined)
      override.patch = (payload.patch ?? []) as any;
    if (payload.description !== undefined)
      override.description = payload.description;

    const saved = await this.productContextOverrideRepository.save(override);
    await this.clearProductCaches(productId);
    return saved;
  }

  async removeContextOverride(
    productId: string,
    overrideId: string,
  ): Promise<void> {
    const override = await this.productContextOverrideRepository.findOne({
      where: { id: overrideId, productId },
    });
    if (!override)
      throw new NotFoundException('Product context override not found');

    await this.productContextOverrideRepository.remove(override);
    await this.clearProductCaches(productId);
  }

  async addProductPrice(productId: string, payload: CreateProductPriceDto) {
    throw new BadRequestException(
      'Product-level prices are not supported; use SKU prices instead',
    );
  }

  async addSkuPrice(
    productId: string,
    skuId: string,
    payload: CreateProductPriceDto,
  ) {
    const sku = await this.skuRepository.findOne({ where: { id: skuId } });
    if (!sku) throw new NotFoundException('Product SKU not found');
    if (sku.productId !== productId) {
      throw new BadRequestException('SKU does not belong to product');
    }

    const list = await this.priceListRepository.findOne({
      where: { id: payload.priceListId },
    });
    if (!list) throw new NotFoundException('Price list not found');

    const currency = await this.currencyRepository.findOne({
      where: { code: list.currency },
    });
    const precision = currency?.precision ?? 2;

    const conditions = (payload.metaJson as any)?.conditions ?? {};

    const row = this.priceRowRepository.create({
      priceListId: list.id,
      targetType: 'SKU',
      targetId: sku.id,
      selectorJson: conditions,
      currencyCode: undefined,
      unitAmount: this.toMinorUnits(payload.unitPrice, precision),
      compareAtAmount:
        payload.compareAtPrice !== undefined
          ? this.toMinorUnits(payload.compareAtPrice, precision)
          : undefined,
      minQuantity: payload.minQuantity ?? 1,
      maxQuantity: payload.maxQuantity,
      validFrom: payload.validFrom ? new Date(payload.validFrom) : undefined,
      validTo: payload.validTo ? new Date(payload.validTo) : undefined,
      tiersJson: [],
      metaJson: payload.metaJson ?? {},
    });

    const saved = await this.priceRowRepository.save(row);
    await this.priceResolveCacheIndex.invalidateBySkuIds([sku.id]);
    await this.priceResolveCacheIndex.invalidateByProductIds([sku.productId]);
    await this.clearProductCaches(sku.productId, [sku.id]);
    return {
      ...saved,
      unitPrice: this.fromMinorUnits(saved.unitAmount, precision),
      compareAtPrice: saved.compareAtAmount
        ? this.fromMinorUnits(saved.compareAtAmount, precision)
        : undefined,
    };
  }

  async listProductPrices(productId: string) {
    throw new BadRequestException(
      'Product-level prices are not supported; use SKU prices instead',
    );
  }

  async listSkuPrices(productId: string, skuId: string) {
    const sku = await this.skuRepository.findOne({ where: { id: skuId } });
    if (!sku) throw new NotFoundException('Product SKU not found');
    if (sku.productId !== productId) {
      throw new BadRequestException('SKU does not belong to product');
    }
    const rows = await this.priceRowRepository.find({
      where: { targetType: 'SKU' as any, targetId: sku.id },
      order: { createdAt: 'DESC' },
    });

    const priceListIds = Array.from(new Set(rows.map((r) => r.priceListId)));
    const lists = priceListIds.length
      ? await this.priceListRepository.find({ where: { id: In(priceListIds) } })
      : [];
    const listById = new Map(lists.map((l) => [l.id, l] as const));
    const currencyCodes = Array.from(new Set(lists.map((l) => l.currency)));
    const currencies = currencyCodes.length
      ? await this.currencyRepository.find({
          where: { code: In(currencyCodes) },
        })
      : [];
    const precisionByCode = new Map(
      currencies.map((c) => [c.code, c.precision] as const),
    );

    return rows.map((r) => {
      const list = listById.get(r.priceListId);
      const precision = precisionByCode.get(list?.currency ?? '') ?? 2;
      return {
        ...r,
        unitPrice: this.fromMinorUnits(r.unitAmount, precision),
        compareAtPrice: r.compareAtAmount
          ? this.fromMinorUnits(r.compareAtAmount, precision)
          : undefined,
      };
    });
  }

  private async findOneEntityOrThrow(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private stableStringify(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.stableStringify(v)).join(',')}]`;
    }
    const obj = value as Record<string, any>;
    const keys = Object.keys(obj).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${this.stableStringify(obj[k])}`)
      .join(',')}}`;
  }

  private priceRowIdentityKey(args: {
    skuId: string;
    priceListId: string;
    minQuantity?: number;
    maxQuantity?: number;
    validFrom?: string;
    validTo?: string;
    metaJson?: Record<string, unknown>;
  }): string {
    const conditions = (args.metaJson as any)?.conditions ?? {};
    const selectorHash = cacheKeyHash(this.stableStringify(conditions));
    return [
      args.skuId,
      args.priceListId,
      String(args.minQuantity ?? 1),
      String(args.maxQuantity ?? ''),
      String(args.validFrom ?? ''),
      String(args.validTo ?? ''),
      selectorHash,
    ].join('|');
  }

  private async upsertSkus(
    productId: string,
    slug: string,
    productTitle: string,
    skus: CreateProductSkuDto[],
    optionDefinitions: Array<{
      key: string;
      allowedValues?: string[];
      required?: boolean;
    }>,
    mode: 'replace' | 'patch',
    manager?: EntityManager,
  ): Promise<{
    skus: ProductSku[];
    deletedSkuIds: string[];
    touchedSkuIds: string[];
    channels: string[];
    shouldSyncChannels: boolean;
  }> {
    const { skuRepository } = this.getRepos(manager);

    const existingSkus = await skuRepository.find({ where: { productId } });
    const existingById = new Map(existingSkus.map((s) => [s.id, s] as const));
    const existingByCode = new Map(
      existingSkus
        .filter((s) => Boolean(s.sku))
        .map((s) => [String(s.sku), s] as const),
    );

    const normalized: CreateProductSkuDto[] = skus?.length
      ? skus
      : ([{ title: productTitle, isDefault: true }] as any);

    const defs = (optionDefinitions ?? []).filter(
      (d) => d && typeof d.key === 'string' && d.key.trim().length > 0,
    );
    const allowedKeys = new Set(defs.map((d) => d.key));
    const requiredKeys = new Set(
      defs.filter((d) => d.required).map((d) => d.key),
    );
    const allowedValuesByKey = new Map(
      defs.map(
        (d) => [d.key, (d.allowedValues ?? []).map((v) => String(v))] as const,
      ),
    );

    const validateOptions = (options: Record<string, unknown>) => {
      if (!defs.length) return;

      for (const key of Object.keys(options ?? {})) {
        if (!allowedKeys.has(key)) {
          throw new BadRequestException(`Invalid option key: ${key}`);
        }
      }

      for (const requiredKey of requiredKeys) {
        if (
          options?.[requiredKey] === undefined ||
          options?.[requiredKey] === null ||
          options?.[requiredKey] === ''
        ) {
          throw new BadRequestException(`Missing required option: ${requiredKey}`);
        }
      }

      for (const [key, allowed] of allowedValuesByKey.entries()) {
        if (!allowed.length) continue;
        if (options?.[key] === undefined || options?.[key] === null) continue;
        const v = String(options[key]);
        if (!allowed.includes(v)) {
          throw new BadRequestException(`Invalid value for option '${key}': ${v}`);
        }
      }
    };

    const ensuredDefaultIndex = normalized.findIndex((s) => s.isDefault);
    const defaultIdx = ensuredDefaultIndex >= 0 ? ensuredDefaultIndex : 0;

    const shouldSyncChannels =
      mode === 'replace' ||
      normalized.some((s) => (s as any).availability !== undefined);

    const toSave: ProductSku[] = [];
    const touchedSkuIds: string[] = [];
    const matchedExistingIds = new Set<string>();

    for (const [index, input] of normalized.entries()) {
      const inputId = String((input as any).id ?? '').trim();
      const inputCode = String(input?.sku ?? '').trim();

      const existing =
        (inputId && existingById.get(inputId)) ||
        (inputCode && existingByCode.get(inputCode)) ||
        null;

      const skuCode =
        inputCode || existing?.sku || (await this.generateSku(slug, index, manager));

      const rawStatus =
        input.status !== undefined
          ? String(input.status ?? 'active').toLowerCase()
          : String(existing?.status ?? 'active').toLowerCase();
      const status =
        rawStatus === 'active' || rawStatus === 'archived'
          ? rawStatus
          : 'inactive';

      const positionRaw =
        input.position !== undefined ? input.position : (existing as any)?.position;
      const positionCandidate =
        typeof positionRaw === 'number'
          ? positionRaw
          : Number.parseInt(String(positionRaw ?? ''), 10);
      const position = Number.isFinite(positionCandidate) ? positionCandidate : index;

      const optionsProvided =
        (input as any).options !== undefined || (input as any).attributes !== undefined;
      const options = optionsProvided
        ? (((input as any).options ?? (input as any).attributes ?? {}) as Record<
            string,
            unknown
          >)
        : (((existing as any)?.options ?? (existing as any)?.attributes ?? {}) as Record<
            string,
            unknown
          >);
      validateOptions(options);

      const availabilityProvided = (input as any).availability !== undefined;
      const availability = availabilityProvided
        ? this.normalizeAvailability((input as any).availability)
        : ((existing as any)?.availability ?? this.normalizeAvailability(undefined));

      const imagesProvided = (input as any).images !== undefined;
      const imagesJson = imagesProvided
        ? this.normalizeImages((input as any).images)
        : ((existing as any)?.imagesJson ?? []);

      const inventoryProvided = (input as any).inventory !== undefined;
      const inventory = inventoryProvided
        ? ((input as any).inventory ?? {})
        : ((existing as any)?.inventory ?? {});

      const entity = existing
        ? existing
        : skuRepository.create({ productId } as DeepPartial<ProductSku>);

      Object.assign(entity, {
        productId,
        title:
          input.title !== undefined
            ? input.title
            : entity.title ?? productTitle,
        sku: skuCode,
        externalRef:
          input.externalRef !== undefined ? input.externalRef : entity.externalRef,
        status: status as any,
        isDefault:
          input.isDefault !== undefined
            ? input.isDefault
            : mode === 'replace'
              ? index === defaultIdx
              : (entity as any).isDefault,
        position,
        options: options as any,
        attributes: options as any,
        imagesJson,
        availability: availability as any,
        inventory: inventory as any,
        requiresShipping:
          (input as any).requiresShipping !== undefined
            ? (input as any).requiresShipping
            : (entity as any).requiresShipping,
        weight:
          (input as any).weight !== undefined
            ? (input as any).weight.toString()
            : (entity as any).weight,
        length:
          (input as any).length !== undefined
            ? (input as any).length.toString()
            : (entity as any).length,
        width:
          (input as any).width !== undefined
            ? (input as any).width.toString()
            : (entity as any).width,
        height:
          (input as any).height !== undefined
            ? (input as any).height.toString()
            : (entity as any).height,
        dimensionUnit:
          (input as any).dimensionUnit !== undefined
            ? (input as any).dimensionUnit
            : (entity as any).dimensionUnit,
        weightUnit:
          (input as any).weightUnit !== undefined
            ? (input as any).weightUnit
            : (entity as any).weightUnit,
        metaJson:
          (input as any).metaJson !== undefined
            ? (input as any).metaJson
            : (entity as any).metaJson,
      });

      toSave.push(entity);
      if (existing?.id) matchedExistingIds.add(existing.id);
    }

    const saved = await skuRepository.save(toSave);
    for (const s of saved) touchedSkuIds.push(s.id);

    const deletedSkuIds: string[] = [];
    if (mode === 'replace') {
      for (const s of existingSkus) {
        if (!matchedExistingIds.has(s.id)) deletedSkuIds.push(s.id);
      }
      if (deletedSkuIds.length) {
        await skuRepository.delete({ id: In(deletedSkuIds) } as any);
      }
    }

    const finalSkus = await skuRepository.find({ where: { productId } });
    const channelSet = new Set<string>();
    for (const sku of finalSkus) {
      const channels = ((sku as any).availability?.channels ?? []) as string[];
      for (const c of channels) channelSet.add(String(c));
    }

    return {
      skus: finalSkus,
      deletedSkuIds,
      touchedSkuIds,
      channels: Array.from(channelSet),
      shouldSyncChannels,
    };
  }

  private async persistSkus(
    productId: string,
    slug: string,
    productTitle: string,
    skus?: CreateProductSkuDto[],
    optionDefinitions?: Array<{
      key: string;
      allowedValues?: string[];
      required?: boolean;
    }>,
    manager?: EntityManager,
  ): Promise<{
    skus: ProductSku[];
    inputs: CreateProductSkuDto[];
    channels: string[];
  }> {
    const { skuRepository } = this.getRepos(manager);
    const normalized: CreateProductSkuDto[] = skus?.length
      ? skus
      : [
          {
            title: productTitle,
            isDefault: true,
          },
        ];

    const defs = (optionDefinitions ?? []).filter(
      (d) => d && typeof d.key === 'string' && d.key.trim().length > 0,
    );
    const allowedKeys = new Set(defs.map((d) => d.key));
    const requiredKeys = new Set(
      defs.filter((d) => d.required).map((d) => d.key),
    );
    const allowedValuesByKey = new Map(
      defs.map(
        (d) => [d.key, (d.allowedValues ?? []).map((v) => String(v))] as const,
      ),
    );

    const validateOptions = (options: Record<string, unknown>) => {
      if (!defs.length) return;

      for (const key of Object.keys(options ?? {})) {
        if (!allowedKeys.has(key)) {
          throw new BadRequestException(`Invalid option key: ${key}`);
        }
      }

      for (const requiredKey of requiredKeys) {
        if (
          options?.[requiredKey] === undefined ||
          options?.[requiredKey] === null ||
          options?.[requiredKey] === ''
        ) {
          throw new BadRequestException(
            `Missing required option: ${requiredKey}`,
          );
        }
      }

      for (const [key, allowed] of allowedValuesByKey.entries()) {
        if (!allowed.length) continue;
        if (options?.[key] === undefined || options?.[key] === null) continue;
        const v = String(options[key]);
        if (!allowed.includes(v)) {
          throw new BadRequestException(
            `Invalid value for option '${key}': ${v}`,
          );
        }
      }
    };

    const skuEntities: ProductSku[] = [];
    const channelSet = new Set<string>();
    for (const [index, v] of normalized.entries()) {
      const sku =
        v.sku?.trim() || (await this.generateSku(slug, index, manager));

      const rawStatus = String(v.status ?? 'active').toLowerCase();
      const status =
        rawStatus === 'active' || rawStatus === 'archived'
          ? rawStatus
          : 'inactive';

      const positionRaw = v.position;
      const positionCandidate =
        typeof positionRaw === 'number'
          ? positionRaw
          : Number.parseInt(String(positionRaw ?? ''), 10);
      const position = Number.isFinite(positionCandidate)
        ? positionCandidate
        : index;

      const options = v.options ?? v.attributes ?? {};
      validateOptions(options);

      const availability = this.normalizeAvailability(v.availability);
      for (const channel of availability.channels ?? []) {
        channelSet.add(channel);
      }

      skuEntities.push(
        skuRepository.create({
          productId,
          title: v.title ?? productTitle,
          sku,
          externalRef: v.externalRef,
          status: status as any,
          isDefault: v.isDefault ?? index === 0,
          position,
          options: options as any,
          attributes: options as any,
          imagesJson: this.normalizeImages(v.images),
          availability: availability as any,
          inventory: (v.inventory ?? {}) as any,
          requiresShipping: v.requiresShipping ?? true,
          weight: v.weight !== undefined ? v.weight.toString() : undefined,
          length: v.length !== undefined ? v.length.toString() : undefined,
          width: v.width !== undefined ? v.width.toString() : undefined,
          height: v.height !== undefined ? v.height.toString() : undefined,
          dimensionUnit: v.dimensionUnit ?? 'cm',
          weightUnit: v.weightUnit ?? 'kg',
          metaJson: v.metaJson ?? {},
        }),
      );
    }

    const saved = await skuRepository.save(skuEntities);
    return { skus: saved, inputs: normalized, channels: Array.from(channelSet) };
  }

  private async persistPrices(
    productId: string,
    prices: CreateProductPriceDto[] | undefined,
    skus: ProductSku[],
    skuInputs: CreateProductSkuDto[] | undefined,
    manager?: EntityManager,
  ) {
    const { priceListRepository, currencyRepository, priceRowRepository } =
      this.getRepos(manager);

    if (prices?.length) {
      throw new BadRequestException(
        'Product-level prices are not supported; provide SKU prices instead',
      );
    }

    const skuById = new Map((skus ?? []).map((s) => [s.id, s] as const));
    const skuByCode = new Map(
      (skus ?? [])
        .filter((s) => Boolean((s as any).sku))
        .map((s) => [String((s as any).sku), s] as const),
    );

    const managedInputs = (skuInputs ?? []).filter((s) =>
      Object.prototype.hasOwnProperty.call(s as any, 'prices'),
    );
    const managedSkuIds: string[] = [];
    const skuIdForInput = (input: CreateProductSkuDto): string | null => {
      const id = String((input as any).id ?? '').trim();
      if (id && skuById.has(id)) return id;
      const code = String(input.sku ?? '').trim();
      if (code && skuByCode.has(code)) return skuByCode.get(code)!.id;
      return null;
    };

    for (const input of managedInputs) {
      const id = skuIdForInput(input);
      if (id) managedSkuIds.push(id);
    }

    const allPriceListIds = new Set<string>();
    for (const skuInput of managedInputs)
      for (const p of (skuInput as any)?.prices ?? [])
        if (p?.priceListId) allPriceListIds.add(p.priceListId);

    const lists = allPriceListIds.size
      ? await priceListRepository.find({
          where: { id: In(Array.from(allPriceListIds)) },
        })
      : [];
    const listById = new Map(lists.map((l) => [l.id, l] as const));

    const currencyCodes = Array.from(new Set(lists.map((l) => l.currency)));
    const currencies = currencyCodes.length
      ? await currencyRepository.find({ where: { code: In(currencyCodes) } })
      : [];
    const precisionByCode = new Map(
      currencies.map((c) => [c.code, c.precision] as const),
    );

    const getPrecisionForList = (priceListId: string) => {
      const list = listById.get(priceListId);
      if (!list) throw new NotFoundException('Price list not found');
      return precisionByCode.get(list.currency) ?? 2;
    };

    if (!managedSkuIds.length) return;

    const existingRows = await priceRowRepository.find({
      where: { targetType: 'SKU' as any, targetId: In(managedSkuIds) },
      order: { createdAt: 'DESC' },
    });

    const existingById = new Map(existingRows.map((r) => [r.id, r] as const));
    const existingByKey = new Map<string, PriceRow>();
    for (const r of existingRows) {
      const key = this.priceRowIdentityKey({
        skuId: r.targetId,
        priceListId: r.priceListId,
        minQuantity: r.minQuantity ?? 1,
        maxQuantity: r.maxQuantity ?? undefined,
        validFrom: r.validFrom ? r.validFrom.toISOString() : undefined,
        validTo: r.validTo ? r.validTo.toISOString() : undefined,
        metaJson: { conditions: r.selectorJson ?? {} },
      });
      if (!existingByKey.has(key)) existingByKey.set(key, r);
    }

    const keepIdsBySkuId = new Map<string, Set<string>>();
    const toSave: PriceRow[] = [];

    for (const skuInput of managedInputs) {
      const skuId = skuIdForInput(skuInput);
      if (!skuId) continue;
      const inputPrices = ((skuInput as any).prices ?? []) as CreateProductPriceDto[];
      const keep = new Set<string>();

      for (const p of inputPrices ?? []) {
        if (!p?.priceListId) continue;
        const precision = getPrecisionForList(p.priceListId);
        const conditions = (p.metaJson as any)?.conditions ?? {};
        const key = this.priceRowIdentityKey({
          skuId,
          priceListId: p.priceListId,
          minQuantity: p.minQuantity ?? 1,
          maxQuantity: p.maxQuantity,
          validFrom: p.validFrom,
          validTo: p.validTo,
          metaJson: p.metaJson ?? {},
        });

        const inputRowId = String((p as any).id ?? '').trim();
        const byId = inputRowId ? existingById.get(inputRowId) : undefined;
        const byKey = existingByKey.get(key);

        const row =
          (byId && byId.targetId === skuId ? byId : undefined) ??
          (byKey && byKey.targetId === skuId ? byKey : undefined) ??
          priceRowRepository.create({
            priceListId: p.priceListId,
            targetType: 'SKU',
            targetId: skuId,
          } as DeepPartial<PriceRow>);

        Object.assign(row, {
          priceListId: p.priceListId,
          targetType: 'SKU',
          targetId: skuId,
          selectorJson: conditions,
          currencyCode: undefined,
          unitAmount: this.toMinorUnits(p.unitPrice, precision),
          compareAtAmount:
            p.compareAtPrice !== undefined
              ? this.toMinorUnits(p.compareAtPrice, precision)
              : undefined,
          minQuantity: p.minQuantity ?? 1,
          maxQuantity: p.maxQuantity,
          validFrom: p.validFrom ? new Date(p.validFrom) : undefined,
          validTo: p.validTo ? new Date(p.validTo) : undefined,
          tiersJson: [],
          metaJson: p.metaJson ?? {},
        });

        toSave.push(row);
        if (row.id) keep.add(row.id);
      }

      keepIdsBySkuId.set(skuId, keep);
    }

    const changedSkuIds = new Set<string>();
    if (toSave.length) {
      const savedRows = await priceRowRepository.save(toSave);
      for (const r of savedRows) changedSkuIds.add(r.targetId);

      // Ensure keep sets include ids for newly inserted rows.
      for (const r of savedRows) {
        const keep = keepIdsBySkuId.get(r.targetId);
        if (keep) keep.add(r.id);
      }
    }

    // Delete only removed rows for SKUs we explicitly managed.
    for (const skuId of managedSkuIds) {
      const keep = keepIdsBySkuId.get(skuId) ?? new Set<string>();
      const existingIds = existingRows
        .filter((r) => r.targetId === skuId)
        .map((r) => r.id);
      const deleteIds = existingIds.filter((id) => !keep.has(id));
      if (deleteIds.length) {
        await priceRowRepository.delete({ id: In(deleteIds) } as any);
        changedSkuIds.add(skuId);
      }
    }

    if (changedSkuIds.size) {
      const skuIdList = Array.from(changedSkuIds);
      await this.priceResolveCacheIndex.invalidateBySkuIds(skuIdList);
      await this.priceResolveCacheIndex.invalidateByProductIds([productId]);
    }
  }

  private normalizeAvailability(
    input?: ProductAvailabilityDto,
  ): AvailabilityNormalized {
    const normalizeList = (values?: string[], upper?: boolean) =>
      Array.from(
        new Set(
          (values ?? [])
            .map((v) => String(v ?? '').trim())
            .filter(Boolean)
            .map((v) => (upper ? v.toUpperCase() : v.toLowerCase())),
        ),
      );

    return {
      channels: normalizeList(input?.channels, true),
      countries: normalizeList(input?.countries, true),
      locations: normalizeList(input?.locations, false),
      stock: {
        type: input?.stock?.type ?? 'FINITE',
        quantity: input?.stock?.quantity,
      },
      schedule: {
        startAt: input?.schedule?.startAt,
        endAt: input?.schedule?.endAt,
      },
      meta: input?.meta ?? {},
    };
  }

  private normalizeImages(images?: string[]): string[] {
    return (images ?? []).map((i) => String(i ?? '').trim()).filter(Boolean);
  }

  private async generateUniqueProductSlug(
    title: string,
    excludeId?: string,
    manager?: EntityManager,
  ): Promise<string> {
    const { productRepository } = this.getRepos(manager);
    const base = this.slugify(title);
    if (!base) throw new BadRequestException('title is required');

    // Append 6 random characters to ensure uniqueness.
    while (true) {
      const suffix = randomBytes(3).toString('hex');
      const slug = `${base}-${suffix}`;
      const exists = await productRepository.exist({
        where: excludeId ? { slug, id: Not(excludeId) } : { slug },
      });
      if (!exists) return slug;
    }
  }

  private slugify(input?: string): string {
    if (!input) return '';
    return input
      .toString()
      .trim()
      .toLowerCase()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  private async generateSku(
    slug: string,
    index: number,
    manager?: EntityManager,
  ): Promise<string> {
    const { skuRepository } = this.getRepos(manager);
    const base = slug.toUpperCase().replace(/[^A-Z0-9]+/g, '-');
    const suffix = randomBytes(2).toString('hex').toUpperCase();
    const candidate = `${base}-${String(index + 1).padStart(2, '0')}-${suffix}`;

    const exists = await skuRepository.exist({ where: { sku: candidate } });
    if (!exists) return candidate;
    return `${candidate}-${randomBytes(1).toString('hex').toUpperCase()}`;
  }

  private async attachCategories(
    productId: string,
    categoryIds: string[],
    manager?: EntityManager,
  ) {
    const { productCategoryRepository } = this.getRepos(manager);
    const categories = categoryIds.map((categoryId, index) =>
      productCategoryRepository.create({
        productId,
        categoryId,
        isPrimary: index === 0,
        sortOrder: index,
      }),
    );
    await productCategoryRepository.save(categories);
  }

  private async syncChannels(
    productId: string,
    channelCodes: string[],
    manager?: EntityManager,
  ): Promise<void> {
    const { productChannelRepository, channelRepository } =
      this.getRepos(manager);
    const normalized = Array.from(
      new Set((channelCodes ?? []).map((c) => c.toUpperCase())),
    );
    await productChannelRepository.delete({ productId } as any);

    if (!normalized.length) return;

    const channels = await channelRepository.find({
      where: { code: In(normalized), isActive: true } as any,
    });
    const foundCodes = new Set(channels.map((c) => c.code.toUpperCase()));

    const missing = normalized.filter((code) => !foundCodes.has(code));
    if (missing.length) {
      throw new BadRequestException(
        `Unknown or inactive channel(s): ${missing.join(', ')}`,
      );
    }

    await productChannelRepository.insert(
      channels.map((c) => ({
        productId,
        channelId: c.id,
        isActive: true,
      })) as any,
    );
  }

  private async clearProductCaches(productId: string, skuIds?: string[]) {
    await this.cache.delByPrefix('catalog:products:list:');
    await this.cache.del(`catalog:products:${productId}`);
    await this.cache.delByPrefix('public:catalog:products:list:');
    await this.cache.delByPrefix('public:catalog:products:');
    await this.cache.delByPrefix('public:catalog:products:view:');
    await this.priceResolveCacheIndex.invalidateByProductIds([productId]);
    if (skuIds?.length) {
      await this.priceResolveCacheIndex.invalidateBySkuIds(skuIds);
    }
    await this.shippingCatalogContextCacheIndex.invalidateByProductIds([
      productId,
    ]);
  }

  private categoryToPublicDto(
    category: Category,
    locale?: string,
  ): PublicProductCategoryRefDto {
    const translations = category.translations ?? [];
    const preferred = (locale || 'en').toLowerCase();
    const t =
      translations.find((x) => x.locale?.toLowerCase() === preferred) ??
      translations.find((x) => x.locale?.toLowerCase().startsWith(preferred)) ??
      translations.find((x) => x.locale?.toLowerCase() === 'en') ??
      translations[0];

    return {
      id: category.id,
      taxonomyId: category.taxonomyId,
      parentId: category.parentId,
      key: category.key,
      slug: category.slug,
      name: t?.name ?? category.key,
    };
  }

  private categoryToPublicCategoryDto(
    category: Category,
    locale?: string,
  ): PublicCategoryDto {
    const translations = category.translations ?? [];
    const preferred = (locale || 'en').toLowerCase();
    const t =
      translations.find((x) => x.locale?.toLowerCase() === preferred) ??
      translations.find((x) => x.locale?.toLowerCase().startsWith(preferred)) ??
      translations.find((x) => x.locale?.toLowerCase() === 'en') ??
      translations[0];

    return {
      id: category.id,
      taxonomyId: category.taxonomyId,
      parentId: category.parentId ?? undefined,
      key: category.key,
      slug: category.slug,
      name: t?.name ?? category.key,
      description: t?.description ?? undefined,
      icon: category.icon ?? undefined,
      avatarUrl: category.avatarUrl ?? undefined,
      imageUrl: category.imageUrl ?? undefined,
      sortOrder: category.sortOrder ?? 0,
      isLeaf: Boolean(category.isLeaf),
    };
  }

  private async resolvePriceForSku(
    productId: string,
    sku?: ProductSku,
    opts?: { priceListId?: string; currencyCode?: string },
  ): Promise<PublicProductPriceDto | undefined> {
    if (!sku && !productId) return undefined;

    try {
      const resolved = await this.priceService.resolveSkuPrice({
        productSkuId: sku?.id,
        productId,
        priceListId: opts?.priceListId,
        currencyCode: opts?.currencyCode,
        quantity: 1,
      });

      return {
        priceListId: resolved.priceListId,
        currencyCode: resolved.currencyCode,
        unitPrice: resolved.unitPrice,
        compareAtPrice: resolved.compareAtPrice,
      };
    } catch {
      return undefined;
    }
  }

  private buildViewContext(input: {
    channel?: string;
    customerGroup?: string;
    location?: string;
    role?: string;
  }): ProductViewContext {
    const context: ProductViewContext = {};
    if (input.channel) context.channel = input.channel.toUpperCase();
    if (input.customerGroup) context.customerGroup = input.customerGroup;
    if (input.location) context.location = input.location;
    if (input.role) context.role = input.role;
    return context;
  }

  private normalizeStringArray(input: unknown): string[] | undefined {
    if (!Array.isArray(input)) return undefined;
    const values = input.map((v) => String(v ?? '').trim()).filter(Boolean);
    if (!values.length) return undefined;
    return Array.from(new Set(values));
  }

  private toContextualOverrideDto(
    override: ProductContextOverride,
  ): ContextualOverrideDTO {
    return {
      id: override.id,
      priority: override.priority,
      isActive: override.isActive,
      validFrom: override.validFrom?.toISOString(),
      validUntil: override.validUntil?.toISOString(),
      match: override.matchContext as any,
      rule: override.rule as any,
      patch: (override.patch ?? []) as any,
      description: override.description,
    };
  }

  private async loadContextOverridesByProductIds(
    productIds: string[],
  ): Promise<Map<string, ContextualOverrideDTO[]>> {
    const ids = Array.from(new Set(productIds.filter(Boolean)));
    const byProduct = new Map<string, ContextualOverrideDTO[]>();
    if (!ids.length) return byProduct;

    const overrides = await this.productContextOverrideRepository.find({
      where: { productId: In(ids) },
    });

    for (const override of overrides) {
      const dto = this.toContextualOverrideDto(override);
      const existing = byProduct.get(override.productId);
      if (existing) {
        existing.push(dto);
      } else {
        byProduct.set(override.productId, [dto]);
      }
    }

    return byProduct;
  }

  private async toProductDTO(
    product: Product,
    opts?: { locale?: string; priceListId?: string; currencyCode?: string },
  ): Promise<ProductDTO> {
    const name: LocalizedString = { en: product.title };
    const description = product.description
      ? ({ en: product.description } as LocalizedString)
      : undefined;

    const categories = (product.productCategories ?? [])
      .map((pc) => pc.category)
      .filter((c): c is Category => Boolean(c))
      .map((c) => this.categoryToPublicCategoryDto(c, opts?.locale));

    const meta = product.metaJson ?? {};
    const tags = this.normalizeStringArray(meta.tags);
    const collections = this.normalizeStringArray(meta.collections);
    const attributes =
      meta.attributes && typeof meta.attributes === 'object'
        ? (meta.attributes as Record<string, unknown>)
        : {};

    const schemaRefRaw = meta.attributeSchemaRef as
      | Record<string, unknown>
      | undefined;
    const attributeSchemaRef = {
      schemaId:
        typeof schemaRefRaw?.schemaId === 'string'
          ? schemaRefRaw.schemaId
          : 'standard',
      schemaVersion:
        typeof schemaRefRaw?.schemaVersion === 'number'
          ? schemaRefRaw.schemaVersion
          : 1,
    };

    const type = typeof meta.type === 'string' ? meta.type : 'standard';

    const defaultSku =
      (product.skus ?? []).find((s) => s.isDefault) ?? (product.skus ?? [])[0];

    const skus = (product.skus ?? []).map((s) => ({
      id: s.id,
      code: s.sku ?? s.id,
      name: { en: s.title ?? product.title },
      attributes: (s.attributes ?? {}) as any,
    }));

    return {
      id: product.id,
      code: product.externalRef ?? product.slug ?? product.id,
      slug: product.slug,
      type,
      categories,
      tags,
      collections,
      brand: product.brand
        ? {
            id: product.brand.id,
            name: product.brand.name,
            slug: product.brand.slug,
            description: product.brand.description,
            logoUrl: product.brand.logoUrl,
            websiteUrl: product.brand.websiteUrl,
          }
        : undefined,
      name,
      description,
      attributes: attributes as any,
      attributeSchemaRef,
      status: product.status,
      skus,
    };
  }

  private async toProductView(
    product: Product,
    overrides: ContextualOverrideDTO[] | undefined,
    opts?: {
      locale?: string;
      priceListId?: string;
      currencyCode?: string;
      context?: ProductViewContext;
    },
  ): Promise<ProductViewDTO> {
    const base = await this.toProductDTO(product, {
      locale: opts?.locale,
      priceListId: opts?.priceListId,
      currencyCode: opts?.currencyCode,
    });
    const { product: resolved, appliedOverrides } = applyContextualOverrides(
      base,
      overrides,
      opts?.context ?? {},
    );

    return {
      ...resolved,
      appliedOverrides,
    };
  }

  private async toPublicProduct(
    product: Product,
    opts?: {
      locale?: string;
      includeSkus?: boolean;
      priceListId?: string;
      currencyCode?: string;
    },
  ): Promise<PublicProductDto> {
    const title = product.title;
    const description = product.description;

    const categories = (product.productCategories ?? [])
      .map((pc) => pc.category)
      .filter((c): c is Category => Boolean(c))
      .map((c) => this.categoryToPublicDto(c, opts?.locale));

    const skus = opts?.includeSkus
      ? await Promise.all(
          (product.skus ?? []).map(async (s) => {
            const price = await this.resolvePriceForSku(product.id, s, opts);
            return {
              id: s.id,
              title: s.title ?? product.title,
              sku: s.sku,
              attributes: s.attributes,
              availability: s.availability ?? {},
              images: s.imagesJson,
              price,
            } as PublicProductSkuDto;
          }),
        )
      : [];

    return {
      id: product.id,
      slug: product.slug,
      title,
      description,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      status: product.status,
      externalRef: product.externalRef,
      brand: product.brand
        ? {
            id: product.brand.id,
            name: product.brand.name,
            slug: product.brand.slug,
            description: product.brand.description,
            logoUrl: product.brand.logoUrl,
            websiteUrl: product.brand.websiteUrl,
          }
        : undefined,
      skus,
      categories,
    };
  }
}
