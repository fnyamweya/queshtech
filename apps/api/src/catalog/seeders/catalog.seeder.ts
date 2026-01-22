import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Taxonomy } from '../entities/taxonomy.entity';
import { Category } from '../entities/category.entity';
import { Product } from '../entities/product.entity';
import { ProductSku } from '../entities/product-sku.entity';
import { Currency } from '../entities/currency.entity';
import { PriceList } from '../entities/price-list.entity';
import { ProductSkuPricing } from '../entities/product-sku-pricing.entity';
import { ProductStatus } from '../dto/create-product.dto';
import { CategoryService } from '../services/category.service';
import { ProductService } from '../services/product.service';
import { Brand } from '../entities/brand.entity';

@Injectable()
export class CatalogSeeder {
  private readonly logger = new Logger(CatalogSeeder.name);

  constructor(
    @InjectRepository(Taxonomy)
    private readonly taxonomyRepository: Repository<Taxonomy>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductSku)
    private readonly skuRepository: Repository<ProductSku>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(PriceList)
    private readonly priceListRepository: Repository<PriceList>,
    @InjectRepository(ProductSkuPricing)
    private readonly skuPricingRepository: Repository<ProductSkuPricing>,
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
    private readonly categoryService: CategoryService,
    private readonly productService: ProductService,
  ) {}

  async seed() {
    await this.resetCatalogData();

    const priceList = await this.ensureCurrencyAndPriceList();
    const [nova, acme] = await this.seedBrands();

    const taxonomy = await this.ensureDefaultTaxonomy();
    const categories = await this.seedCategories(taxonomy.id);

    await this.seedProducts({
      priceList,
      brands: { nova, acme },
      categories,
    });
  }

  private async resetCatalogData(): Promise<void> {
    await this.skuPricingRepository
      .createQueryBuilder()
      .delete()
      .from(ProductSkuPricing)
      .execute();
    await this.skuRepository
      .createQueryBuilder()
      .delete()
      .from(ProductSku)
      .execute();
    await this.productRepository
      .createQueryBuilder()
      .delete()
      .from(Product)
      .execute();
    await this.categoryRepository
      .createQueryBuilder()
      .delete()
      .from(Category)
      .execute();
    await this.taxonomyRepository
      .createQueryBuilder()
      .delete()
      .from(Taxonomy)
      .execute();
    await this.brandRepository
      .createQueryBuilder()
      .delete()
      .from(Brand)
      .execute();
  }

  private async ensureDefaultTaxonomy(): Promise<Taxonomy> {
    const taxonomy = this.taxonomyRepository.create({
      code: 'default',
      name: 'Default Catalog',
      description: 'Primary storefront taxonomy',
      isDefault: true,
    });
    const saved = await this.taxonomyRepository.save(taxonomy);
    this.logger.log('Created default taxonomy');
    return saved;
  }

  private async seedBrands(): Promise<[Brand, Brand]> {
    const nova = await this.brandRepository.save(
      this.brandRepository.create({
        name: 'Nova',
        slug: 'nova',
        description: 'Premium electronics and devices',
        logoUrl: 'https://cdn.example.com/brands/nova.png',
        websiteUrl: 'https://example.com/nova',
        isActive: true,
        metaJson: { tier: 'premium' },
      }),
    );

    const acme = await this.brandRepository.save(
      this.brandRepository.create({
        name: 'Acme',
        slug: 'acme',
        description: 'Everyday accessories and essentials',
        logoUrl: 'https://cdn.example.com/brands/acme.png',
        websiteUrl: 'https://example.com/acme',
        isActive: true,
        metaJson: { tier: 'value' },
      }),
    );

    this.logger.log('Seeded brands Nova and Acme');
    return [nova, acme];
  }

  private async seedCategories(taxonomyId: string): Promise<{
    electronics: Category;
    phones: Category;
    laptops: Category;
    audio: Category;
    gaming: Category;
    wearables: Category;
    tv: Category;
    accessories: Category;
    home: Category;
    lighting: Category;
    power: Category;
    test: Category;
  }> {
    const electronics = await this.categoryService.create({
      taxonomyId,
      key: 'electronics',
      slug: 'electronics',
      translations: [{ locale: 'en', name: 'Electronics' }],
    });

    const phones = await this.categoryService.create({
      taxonomyId,
      parentId: electronics.id,
      key: 'phones',
      slug: 'phones',
      translations: [{ locale: 'en', name: 'Phones' }],
    });

    const laptops = await this.categoryService.create({
      taxonomyId,
      parentId: electronics.id,
      key: 'laptops',
      slug: 'laptops',
      translations: [{ locale: 'en', name: 'Laptops' }],
    });

    const audio = await this.categoryService.create({
      taxonomyId,
      parentId: electronics.id,
      key: 'audio',
      slug: 'audio',
      translations: [{ locale: 'en', name: 'Audio' }],
    });

    const gaming = await this.categoryService.create({
      taxonomyId,
      parentId: electronics.id,
      key: 'gaming',
      slug: 'gaming',
      translations: [{ locale: 'en', name: 'Gaming' }],
    });

    const wearables = await this.categoryService.create({
      taxonomyId,
      parentId: electronics.id,
      key: 'wearables',
      slug: 'wearables',
      translations: [{ locale: 'en', name: 'Wearables' }],
    });

    const tv = await this.categoryService.create({
      taxonomyId,
      parentId: electronics.id,
      key: 'tv',
      slug: 'tv',
      translations: [{ locale: 'en', name: 'TV & Home Entertainment' }],
    });

    const accessories = await this.categoryService.create({
      taxonomyId,
      parentId: electronics.id,
      key: 'accessories',
      slug: 'accessories',
      translations: [{ locale: 'en', name: 'Accessories' }],
    });

    const home = await this.categoryService.create({
      taxonomyId,
      key: 'home',
      slug: 'home',
      translations: [{ locale: 'en', name: 'Home' }],
    });

    const lighting = await this.categoryService.create({
      taxonomyId,
      parentId: home.id,
      key: 'lighting',
      slug: 'lighting',
      translations: [{ locale: 'en', name: 'Lighting' }],
    });

    const power = await this.categoryService.create({
      taxonomyId,
      parentId: home.id,
      key: 'power',
      slug: 'power',
      translations: [{ locale: 'en', name: 'Power & Energy' }],
    });

    const test = await this.categoryService.create({
      taxonomyId,
      key: 'test',
      slug: 'test',
      translations: [{ locale: 'en', name: 'Test' }],
    });

    this.logger.log('Seeded categories');
    return {
      electronics,
      phones,
      laptops,
      audio,
      gaming,
      wearables,
      tv,
      accessories,
      home,
      lighting,
      power,
      test,
    };
  }

  private async ensureCurrencyAndPriceList(): Promise<PriceList> {
    // Ensure KES exists
    let kes = await this.currencyRepository.findOne({ where: { code: 'KES' } });
    if (!kes) {
      kes = this.currencyRepository.create({
        code: 'KES',
        precision: 2,
        symbol: 'KES',
      });
      kes = await this.currencyRepository.save(kes);
      this.logger.log('Created currency KES');
    }

    // Ensure price list exists
    let priceList = await this.priceListRepository.findOne({
      where: { code: 'retail-kes' },
    });
    if (!priceList) {
      priceList = this.priceListRepository.create({
        code: 'retail-kes',
        name: 'Retail (KES)',
        currency: 'KES',
        status: 'active',
        priority: 1,
        scope: {},
        stackingPolicy: 'EXCLUSIVE',
        conflictPolicy: 'HIGHEST_PRIORITY',
        stopAfterMatch: true,
        type: 'BASE',
        validFrom: undefined,
        validTo: undefined,
        metaJson: { priority: 1 },
      });
      priceList = await this.priceListRepository.save(priceList);
      this.logger.log('Created price list retail-kes');
    }

    return priceList;
  }

  private async seedProducts(payload: {
    priceList: PriceList;
    brands: { nova: Brand; acme: Brand };
    categories: {
      phones: Category;
      laptops: Category;
      audio: Category;
      gaming: Category;
      wearables: Category;
      tv: Category;
      accessories: Category;
      lighting: Category;
      power: Category;
      test: Category;
    };
  }): Promise<void> {
    const channels = ['WEB', 'MOBILE', 'WHATSAPP'];
    const availability = {
      channels,
      countries: ['KE', 'TZ'],
      locations: ['Nairobi', 'Dar es Salaam'],
      stock: { type: 'FINITE', quantity: 120 },
      schedule: {
        startAt: '2025-01-01T00:00:00Z',
        endAt: '2026-01-01T00:00:00Z',
      },
      meta: { source: 'seed' },
    };

    const createProduct = async (input: Parameters<ProductService['create']>[0]) =>
      this.productService.create(input);

    await createProduct({
      title: 'Nova X Phone',
      description: 'Flagship smartphone with pro-grade camera and long battery life.',
      shortDescription: 'Flagship phone • pro camera • all-day battery',
      status: ProductStatus.ACTIVE,
      externalRef: 'NOVA-X-001',
      brandId: payload.brands.nova.id,
      categoryIds: [payload.categories.phones.id],
      optionDefinitions: [
        { key: 'color', label: 'Color', required: true, allowedValues: ['black', 'silver', 'blue'], componentType: 'color_swatch' },
        { key: 'storage', label: 'Storage', required: true, allowedValues: ['128GB', '256GB', '512GB'], componentType: 'select' },
      ],
      skus: [
        {
          title: 'Black / 128GB',
          sku: 'NOVA-X-BLK-128',
          isDefault: true,
          options: { color: 'black', storage: '128GB' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 129999, compareAtPrice: 139999, minQuantity: 1 }],
        },
        {
          title: 'Black / 256GB',
          sku: 'NOVA-X-BLK-256',
          options: { color: 'black', storage: '256GB' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 144999, compareAtPrice: 159999, minQuantity: 1 }],
        },
        {
          title: 'Silver / 256GB',
          sku: 'NOVA-X-SLV-256',
          options: { color: 'silver', storage: '256GB' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 149999, compareAtPrice: 159999, minQuantity: 1 }],
        },
        {
          title: 'Blue / 512GB',
          sku: 'NOVA-X-BLU-512',
          options: { color: 'blue', storage: '512GB' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 179999, compareAtPrice: 189999, minQuantity: 1 }],
        },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1200&q=80', isPrimary: true },
        { url: 'https://images.unsplash.com/photo-1592286927505-b45d9c862e0f?w=1200&q=80' },
      ],
      metaJson: { tags: ['smartphone', 'nova', 'flagship'], badge: 'Bestseller' },
    });

    await createProduct({
      title: 'Nova Lite Phone',
      description: 'Slim, fast, and affordable 5G smartphone built for everyday use.',
      shortDescription: 'Affordable 5G • smooth display • long battery',
      status: ProductStatus.ACTIVE,
      externalRef: 'NOVA-LITE-001',
      brandId: payload.brands.nova.id,
      categoryIds: [payload.categories.phones.id],
      optionDefinitions: [
        { key: 'color', label: 'Color', required: true, allowedValues: ['black', 'green'], componentType: 'color_swatch' },
        { key: 'storage', label: 'Storage', required: true, allowedValues: ['64GB', '128GB'], componentType: 'select' },
      ],
      skus: [
        {
          title: 'Black / 64GB',
          sku: 'NOVA-LITE-BLK-64',
          isDefault: true,
          options: { color: 'black', storage: '64GB' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 49999, compareAtPrice: 54999, minQuantity: 1 }],
        },
        {
          title: 'Green / 128GB',
          sku: 'NOVA-LITE-GRN-128',
          options: { color: 'green', storage: '128GB' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 57999, compareAtPrice: 62999, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['smartphone', 'budget', '5g'], badge: 'New' },
    });

    await createProduct({
      title: 'Nova Tab 11',
      description: '11-inch tablet for work and play with quad speakers and all-day battery.',
      shortDescription: '11-inch • quad speakers • all-day battery',
      status: ProductStatus.ACTIVE,
      externalRef: 'NOVA-TAB-11',
      brandId: payload.brands.nova.id,
      categoryIds: [payload.categories.phones.id],
      optionDefinitions: [
        { key: 'storage', label: 'Storage', required: true, allowedValues: ['128GB', '256GB'], componentType: 'select' },
        { key: 'connectivity', label: 'Connectivity', required: true, allowedValues: ['WiFi', 'LTE'], componentType: 'select' },
      ],
      skus: [
        {
          title: '128GB / WiFi',
          sku: 'NOVA-TAB11-128-WIFI',
          isDefault: true,
          options: { storage: '128GB', connectivity: 'WiFi' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 69999, compareAtPrice: 74999, minQuantity: 1 }],
        },
        {
          title: '256GB / LTE',
          sku: 'NOVA-TAB11-256-LTE',
          options: { storage: '256GB', connectivity: 'LTE' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 89999, compareAtPrice: 94999, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['tablet', 'productivity'] },
    });

    await createProduct({
      title: 'NovaBook Air 13',
      description: 'Ultra-light laptop with premium display and silent performance.',
      shortDescription: 'Ultra-light • premium display • all-day battery',
      status: ProductStatus.ACTIVE,
      externalRef: 'NOVABOOK-AIR-13',
      brandId: payload.brands.nova.id,
      categoryIds: [payload.categories.laptops.id],
      optionDefinitions: [
        { key: 'color', label: 'Color', required: true, allowedValues: ['silver', 'midnight'], componentType: 'select' },
        { key: 'ram', label: 'RAM', required: true, allowedValues: ['8GB', '16GB'], componentType: 'select' },
        { key: 'storage', label: 'Storage', required: true, allowedValues: ['256GB', '512GB'], componentType: 'select' },
      ],
      skus: [
        {
          title: 'Silver / 8GB / 256GB',
          sku: 'NBOOK-AIR13-SLV-8-256',
          isDefault: true,
          options: { color: 'silver', ram: '8GB', storage: '256GB' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 129999, compareAtPrice: 139999, minQuantity: 1 }],
        },
        {
          title: 'Midnight / 16GB / 512GB',
          sku: 'NBOOK-AIR13-MID-16-512',
          options: { color: 'midnight', ram: '16GB', storage: '512GB' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 169999, compareAtPrice: 179999, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['laptop', 'ultrabook'] },
    });

    await createProduct({
      title: 'NovaBook Pro 16',
      description: 'High-performance creator laptop with discrete graphics and fast storage.',
      shortDescription: 'Creator-class • fast storage • powerful graphics',
      status: ProductStatus.ACTIVE,
      externalRef: 'NOVABOOK-PRO-16',
      brandId: payload.brands.nova.id,
      categoryIds: [payload.categories.laptops.id],
      optionDefinitions: [
        { key: 'ram', label: 'RAM', required: true, allowedValues: ['16GB', '32GB'], componentType: 'select' },
        { key: 'storage', label: 'Storage', required: true, allowedValues: ['1TB', '2TB'], componentType: 'select' },
        { key: 'gpu', label: 'Graphics', required: true, allowedValues: ['RTX-4060', 'RTX-4070'], componentType: 'select' },
      ],
      skus: [
        {
          title: '16GB / 1TB / RTX-4060',
          sku: 'NBOOK-PRO16-16-1T-4060',
          isDefault: true,
          options: { ram: '16GB', storage: '1TB', gpu: 'RTX-4060' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 239999, compareAtPrice: 259999, minQuantity: 1 }],
        },
        {
          title: '32GB / 2TB / RTX-4070',
          sku: 'NBOOK-PRO16-32-2T-4070',
          options: { ram: '32GB', storage: '2TB', gpu: 'RTX-4070' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 319999, compareAtPrice: 339999, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['laptop', 'creator', 'performance'], badge: 'Bestseller' },
    });

    await createProduct({
      title: 'Acme Fast Charger',
      description: 'Compact USB-C charger with fast charging support.',
      shortDescription: 'USB‑C • fast charge • compact',
      status: ProductStatus.ACTIVE,
      externalRef: 'ACME-CHG-FAST',
      brandId: payload.brands.acme.id,
      categoryIds: [payload.categories.accessories.id],
      optionDefinitions: [
        { key: 'color', label: 'Color', required: true, allowedValues: ['white', 'black'], componentType: 'select' },
        { key: 'power', label: 'Power', required: true, allowedValues: ['20W', '30W', '45W'], componentType: 'select' },
      ],
      skus: [
        {
          title: 'White / 30W',
          sku: 'ACME-CHG-WHT-30',
          isDefault: true,
          options: { color: 'white', power: '30W' },
          availability: {
            ...availability,
            stock: { type: 'FINITE', quantity: 300 },
          },
          prices: [
            {
              priceListId: payload.priceList.id,
              unitPrice: 3999,
              compareAtPrice: 4999,
              minQuantity: 1,
            },
          ],
        },
        {
          title: 'Black / 45W',
          sku: 'ACME-CHG-BLK-45',
          options: { color: 'black', power: '45W' },
          availability: {
            ...availability,
            stock: { type: 'FINITE', quantity: 180 },
          },
          prices: [
            {
              priceListId: payload.priceList.id,
              unitPrice: 5499,
              compareAtPrice: 5999,
              minQuantity: 1,
            },
          ],
        },
      ],
      images: [
        { url: 'https://cdn.example.com/products/acme-charger/main.png', isPrimary: true },
      ],
      metaJson: { tags: ['charger', 'accessory'] },
    });

    await createProduct({
      title: 'Acme USB‑C Cable',
      description: 'Durable braided USB‑C cable with fast charging and data transfer.',
      shortDescription: 'Braided • fast charge • USB‑C',
      status: ProductStatus.ACTIVE,
      externalRef: 'ACME-CABLE-USBC',
      brandId: payload.brands.acme.id,
      categoryIds: [payload.categories.accessories.id],
      optionDefinitions: [
        { key: 'length', label: 'Length', required: true, allowedValues: ['1m', '2m'], componentType: 'select' },
        { key: 'color', label: 'Color', required: true, allowedValues: ['black', 'red'], componentType: 'select' },
      ],
      skus: [
        {
          title: '1m / Black',
          sku: 'ACME-CBL-USBC-1M-BLK',
          isDefault: true,
          options: { length: '1m', color: 'black' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 500 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 999, compareAtPrice: 1299, minQuantity: 1 }],
        },
        {
          title: '2m / Red',
          sku: 'ACME-CBL-USBC-2M-RED',
          options: { length: '2m', color: 'red' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 260 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 1299, compareAtPrice: 1599, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1586952518485-11b180e92764?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['cable', 'accessory'] },
    });

    await createProduct({
      title: 'Acme Power Bank',
      description: 'High-capacity power bank with USB‑C PD and dual output.',
      shortDescription: 'USB‑C PD • dual output • travel-ready',
      status: ProductStatus.ACTIVE,
      externalRef: 'ACME-PBANK-001',
      brandId: payload.brands.acme.id,
      categoryIds: [payload.categories.power.id],
      optionDefinitions: [
        { key: 'capacity', label: 'Capacity', required: true, allowedValues: ['10000mAh', '20000mAh'], componentType: 'select' },
        { key: 'color', label: 'Color', required: true, allowedValues: ['black', 'white'], componentType: 'select' },
      ],
      skus: [
        {
          title: '10000mAh / White',
          sku: 'ACME-PBANK-10K-WHT',
          isDefault: true,
          options: { capacity: '10000mAh', color: 'white' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 140 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 3999, compareAtPrice: 4499, minQuantity: 1 }],
        },
        {
          title: '20000mAh / Black',
          sku: 'ACME-PBANK-20K-BLK',
          options: { capacity: '20000mAh', color: 'black' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 90 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 5999, compareAtPrice: 6999, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1609592786331-92d6d262e52b?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['power', 'battery', 'travel'] },
    });

    await createProduct({
      title: 'Nova Buds Pro',
      description: 'True wireless earbuds with active noise cancellation and deep bass.',
      shortDescription: 'ANC • deep bass • pocketable',
      status: ProductStatus.ACTIVE,
      externalRef: 'NOVA-BUDS-PRO',
      brandId: payload.brands.nova.id,
      categoryIds: [payload.categories.audio.id],
      optionDefinitions: [
        { key: 'color', label: 'Color', required: true, allowedValues: ['black', 'white'], componentType: 'select' },
      ],
      skus: [
        {
          title: 'Black',
          sku: 'NOVA-BUDS-PRO-BLK',
          isDefault: true,
          options: { color: 'black' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 18999, compareAtPrice: 21999, minQuantity: 1 }],
        },
        {
          title: 'White',
          sku: 'NOVA-BUDS-PRO-WHT',
          options: { color: 'white' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 18999, compareAtPrice: 21999, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1585386959984-a41552231693?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['audio', 'earbuds', 'anc'], badge: 'New' },
    });

    await createProduct({
      title: 'Nova Over‑Ear Headphones',
      description: 'Comfort-fit headphones with studio-tuned sound and long battery life.',
      shortDescription: 'Studio-tuned • comfy • long battery',
      status: ProductStatus.ACTIVE,
      externalRef: 'NOVA-OE-001',
      brandId: payload.brands.nova.id,
      categoryIds: [payload.categories.audio.id],
      optionDefinitions: [
        { key: 'color', label: 'Color', required: true, allowedValues: ['black', 'sand'], componentType: 'select' },
        { key: 'type', label: 'Type', required: true, allowedValues: ['Wireless', 'Wired'], componentType: 'select' },
      ],
      skus: [
        {
          title: 'Black / Wireless',
          sku: 'NOVA-OE-BLK-WLS',
          isDefault: true,
          options: { color: 'black', type: 'Wireless' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 24999, compareAtPrice: 27999, minQuantity: 1 }],
        },
        {
          title: 'Sand / Wired',
          sku: 'NOVA-OE-SND-WRD',
          options: { color: 'sand', type: 'Wired' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 17999, compareAtPrice: 19999, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['audio', 'headphones'] },
    });

    await createProduct({
      title: 'Acme Gaming Controller',
      description: 'Ergonomic wireless controller with low-latency input and textured grip.',
      shortDescription: 'Low-latency • ergonomic • wireless',
      status: ProductStatus.ACTIVE,
      externalRef: 'ACME-GAMEPAD-001',
      brandId: payload.brands.acme.id,
      categoryIds: [payload.categories.gaming.id],
      optionDefinitions: [
        { key: 'platform', label: 'Platform', required: true, allowedValues: ['PC', 'PS', 'XBOX'], componentType: 'select' },
        { key: 'color', label: 'Color', required: true, allowedValues: ['black', 'white'], componentType: 'select' },
      ],
      skus: [
        {
          title: 'PC / Black',
          sku: 'ACME-PAD-PC-BLK',
          isDefault: true,
          options: { platform: 'PC', color: 'black' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 5999, compareAtPrice: 6999, minQuantity: 1 }],
        },
        {
          title: 'PS / White',
          sku: 'ACME-PAD-PS-WHT',
          options: { platform: 'PS', color: 'white' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 6499, compareAtPrice: 7499, minQuantity: 1 }],
        },
        {
          title: 'XBOX / Black',
          sku: 'ACME-PAD-XBOX-BLK',
          options: { platform: 'XBOX', color: 'black' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 6499, compareAtPrice: 7499, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['gaming', 'controller'] },
    });

    await createProduct({
      title: 'Nova Watch S',
      description: 'Smartwatch with health tracking, GPS, and a bright always-on display.',
      shortDescription: 'Health tracking • GPS • always-on display',
      status: ProductStatus.ACTIVE,
      externalRef: 'NOVA-WATCH-S',
      brandId: payload.brands.nova.id,
      categoryIds: [payload.categories.wearables.id],
      optionDefinitions: [
        { key: 'size', label: 'Case Size', required: true, allowedValues: ['40mm', '44mm'], componentType: 'select' },
        { key: 'color', label: 'Color', required: true, allowedValues: ['black', 'silver'], componentType: 'select' },
      ],
      skus: [
        {
          title: '40mm / Black',
          sku: 'NOVA-WATCHS-40-BLK',
          isDefault: true,
          options: { size: '40mm', color: 'black' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 27999, compareAtPrice: 29999, minQuantity: 1 }],
        },
        {
          title: '44mm / Silver',
          sku: 'NOVA-WATCHS-44-SLV',
          options: { size: '44mm', color: 'silver' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 29999, compareAtPrice: 32999, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['wearable', 'smartwatch'] },
    });

    await createProduct({
      title: 'Acme Fit Band',
      description: 'Lightweight fitness tracker with sleep tracking and 7-day battery.',
      shortDescription: 'Sleep tracking • 7-day battery • lightweight',
      status: ProductStatus.ACTIVE,
      externalRef: 'ACME-FITBAND',
      brandId: payload.brands.acme.id,
      categoryIds: [payload.categories.wearables.id],
      optionDefinitions: [
        { key: 'color', label: 'Band Color', required: true, allowedValues: ['black', 'blue', 'pink'], componentType: 'select' },
      ],
      skus: [
        {
          title: 'Black',
          sku: 'ACME-FITBAND-BLK',
          isDefault: true,
          options: { color: 'black' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 4999, compareAtPrice: 5999, minQuantity: 1 }],
        },
        {
          title: 'Blue',
          sku: 'ACME-FITBAND-BLU',
          options: { color: 'blue' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 4999, compareAtPrice: 5999, minQuantity: 1 }],
        },
        {
          title: 'Pink',
          sku: 'ACME-FITBAND-PNK',
          options: { color: 'pink' },
          availability,
          prices: [{ priceListId: payload.priceList.id, unitPrice: 4999, compareAtPrice: 5999, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1558089687-e723dae18019?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['wearable', 'fitness'] },
    });

    await createProduct({
      title: 'Nova 55" 4K Smart TV',
      description: 'Ultra HD smart TV with vivid color and built-in streaming apps.',
      shortDescription: '4K UHD • vivid color • smart apps',
      status: ProductStatus.ACTIVE,
      externalRef: 'NOVA-TV-55-4K',
      brandId: payload.brands.nova.id,
      categoryIds: [payload.categories.tv.id],
      optionDefinitions: [
        { key: 'size', label: 'Size', required: true, allowedValues: ['50in', '55in', '65in'], componentType: 'select' },
        { key: 'panel', label: 'Panel', required: true, allowedValues: ['LED', 'QLED'], componentType: 'select' },
      ],
      skus: [
        {
          title: '50in / LED',
          sku: 'NOVA-TV-50-LED',
          isDefault: true,
          options: { size: '50in', panel: 'LED' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 30 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 59999, compareAtPrice: 67999, minQuantity: 1 }],
        },
        {
          title: '55in / QLED',
          sku: 'NOVA-TV-55-QLED',
          options: { size: '55in', panel: 'QLED' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 18 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 84999, compareAtPrice: 92999, minQuantity: 1 }],
        },
        {
          title: '65in / QLED',
          sku: 'NOVA-TV-65-QLED',
          options: { size: '65in', panel: 'QLED' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 12 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 119999, compareAtPrice: 129999, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['tv', 'home-entertainment'] },
    });

    await createProduct({
      title: 'Solar Lantern',
      description: 'Portable solar lantern with adjustable brightness.',
      shortDescription: 'Portable • solar • adjustable brightness',
      status: ProductStatus.ACTIVE,
      externalRef: 'SOL-LANTERN-01',
      brandId: payload.brands.acme.id,
      categoryIds: [payload.categories.lighting.id],
      optionDefinitions: [
        { key: 'type', label: 'Type', required: true, allowedValues: ['Rechargeable'], componentType: 'select' },
      ],
      skus: [
        {
          title: 'Rechargeable',
          sku: 'SOL-LANT-REC',
          isDefault: true,
          options: { type: 'Rechargeable' },
          attributes: { power: 'solar', battery: '4000mAh' },
          availability: {
            ...availability,
            stock: { type: 'FINITE', quantity: 80 },
            schedule: {
              startAt: '2025-03-01T00:00:00Z',
              endAt: '2026-03-01T00:00:00Z',
            },
          },
          prices: [
            {
              priceListId: payload.priceList.id,
              unitPrice: 24999,
              minQuantity: 1,
            },
            {
              priceListId: payload.priceList.id,
              unitPrice: 22999,
              minQuantity: 1,
              metaJson: { conditions: { countryCodes: ['TZ'] } },
            },
          ],
        },
      ],
      images: [
        { url: 'https://cdn.example.com/products/lantern/main.png', isPrimary: true },
      ],
      metaJson: { tags: ['solar', 'lighting', 'outdoor'] },
    });

    await createProduct({
      title: 'Acme Smart Bulb',
      description: 'Wi‑Fi smart bulb with app control and adjustable white temperature.',
      shortDescription: 'Wi‑Fi • app control • adjustable white',
      status: ProductStatus.ACTIVE,
      externalRef: 'ACME-BULB-001',
      brandId: payload.brands.acme.id,
      categoryIds: [payload.categories.lighting.id],
      optionDefinitions: [
        { key: 'socket', label: 'Socket', required: true, allowedValues: ['E27', 'B22'], componentType: 'select' },
        { key: 'temp', label: 'Color Temperature', required: true, allowedValues: ['Warm', 'Neutral', 'Cool'], componentType: 'select' },
      ],
      skus: [
        {
          title: 'E27 / Warm',
          sku: 'ACME-BULB-E27-WARM',
          isDefault: true,
          options: { socket: 'E27', temp: 'Warm' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 220 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 1499, compareAtPrice: 1799, minQuantity: 1 }],
        },
        {
          title: 'B22 / Cool',
          sku: 'ACME-BULB-B22-COOL',
          options: { socket: 'B22', temp: 'Cool' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 160 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 1499, compareAtPrice: 1799, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1519710887725-838f9b5125c2?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['lighting', 'smart-home'] },
    });

    await createProduct({
      title: 'Acme Desk Lamp',
      description: 'Minimal LED desk lamp with dimming and adjustable arm.',
      shortDescription: 'LED • dimmable • adjustable arm',
      status: ProductStatus.ACTIVE,
      externalRef: 'ACME-LAMP-001',
      brandId: payload.brands.acme.id,
      categoryIds: [payload.categories.lighting.id],
      optionDefinitions: [
        { key: 'color', label: 'Color', required: true, allowedValues: ['black', 'white'], componentType: 'select' },
      ],
      skus: [
        {
          title: 'Black',
          sku: 'ACME-LAMP-BLK',
          isDefault: true,
          options: { color: 'black' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 70 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 7999, compareAtPrice: 8999, minQuantity: 1 }],
        },
        {
          title: 'White',
          sku: 'ACME-LAMP-WHT',
          options: { color: 'white' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 70 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 7999, compareAtPrice: 8999, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['lighting', 'desk'] },
    });

    await createProduct({
      title: 'Acme Surge Protector',
      description: '6-outlet surge protector with USB charging ports.',
      shortDescription: '6 outlets • surge protection • USB ports',
      status: ProductStatus.ACTIVE,
      externalRef: 'ACME-SURGE-001',
      brandId: payload.brands.acme.id,
      categoryIds: [payload.categories.power.id],
      optionDefinitions: [
        { key: 'length', label: 'Cable Length', required: true, allowedValues: ['1.5m', '3m'], componentType: 'select' },
      ],
      skus: [
        {
          title: '1.5m',
          sku: 'ACME-SURGE-15M',
          isDefault: true,
          options: { length: '1.5m' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 110 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 2499, compareAtPrice: 2999, minQuantity: 1 }],
        },
        {
          title: '3m',
          sku: 'ACME-SURGE-3M',
          options: { length: '3m' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 80 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 2999, compareAtPrice: 3499, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1583863788434-e58a36330f49?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['power', 'home'] },
    });

    await createProduct({
      title: 'Nova Wi‑Fi 6 Router',
      description: 'High-speed Wi‑Fi 6 router with mesh support and robust parental controls.',
      shortDescription: 'Wi‑Fi 6 • mesh-ready • secure',
      status: ProductStatus.ACTIVE,
      externalRef: 'NOVA-ROUTER-W6',
      brandId: payload.brands.nova.id,
      categoryIds: [payload.categories.accessories.id],
      optionDefinitions: [
        { key: 'type', label: 'Type', required: true, allowedValues: ['Single', '2-Pack Mesh'], componentType: 'select' },
      ],
      skus: [
        {
          title: 'Single',
          sku: 'NOVA-ROUTER-W6-SINGLE',
          isDefault: true,
          options: { type: 'Single' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 45 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 8999, compareAtPrice: 9999, minQuantity: 1 }],
        },
        {
          title: '2-Pack Mesh',
          sku: 'NOVA-ROUTER-W6-MESH2',
          options: { type: '2-Pack Mesh' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 22 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 15999, compareAtPrice: 17999, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1603791440384-56cd371ee9a7?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['networking', 'router', 'wifi6'] },
    });

    await createProduct({
      title: 'Acme Mechanical Keyboard',
      description: 'Hot-swappable mechanical keyboard with per-key RGB and sturdy aluminum frame.',
      shortDescription: 'Hot-swappable • RGB • aluminum frame',
      status: ProductStatus.ACTIVE,
      externalRef: 'ACME-KBD-MECH',
      brandId: payload.brands.acme.id,
      categoryIds: [payload.categories.gaming.id],
      optionDefinitions: [
        { key: 'size', label: 'Layout', required: true, allowedValues: ['TKL', 'Full'], componentType: 'select' },
        { key: 'switch', label: 'Switch', required: true, allowedValues: ['Red', 'Blue', 'Brown'], componentType: 'select' },
      ],
      skus: [
        {
          title: 'TKL / Red',
          sku: 'ACME-KBD-TKL-RED',
          isDefault: true,
          options: { size: 'TKL', switch: 'Red' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 35 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 8999, compareAtPrice: 9999, minQuantity: 1 }],
        },
        {
          title: 'Full / Brown',
          sku: 'ACME-KBD-FULL-BRN',
          options: { size: 'Full', switch: 'Brown' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 25 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 9999, compareAtPrice: 10999, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['gaming', 'keyboard', 'mechanical'] },
    });

    await createProduct({
      title: 'Nova Bluetooth Speaker',
      description: 'Portable Bluetooth speaker with punchy bass and water resistance.',
      shortDescription: 'Portable • water resistant • punchy bass',
      status: ProductStatus.ACTIVE,
      externalRef: 'NOVA-SPKR-BT',
      brandId: payload.brands.nova.id,
      categoryIds: [payload.categories.audio.id],
      optionDefinitions: [
        { key: 'color', label: 'Color', required: true, allowedValues: ['black', 'blue'], componentType: 'select' },
      ],
      skus: [
        {
          title: 'Black',
          sku: 'NOVA-SPKR-BT-BLK',
          isDefault: true,
          options: { color: 'black' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 60 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 6999, compareAtPrice: 7999, minQuantity: 1 }],
        },
        {
          title: 'Blue',
          sku: 'NOVA-SPKR-BT-BLU',
          options: { color: 'blue' },
          availability: { ...availability, stock: { type: 'FINITE', quantity: 50 } },
          prices: [{ priceListId: payload.priceList.id, unitPrice: 6999, compareAtPrice: 7999, minQuantity: 1 }],
        },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=1200&q=80', isPrimary: true }],
      metaJson: { tags: ['audio', 'speaker', 'bluetooth'] },
    });

    this.logger.log('Seeded enriched catalog products');

    await createProduct({
      title: 'Test Product',
      description: 'Seeded test product for QA and local development.',
      status: ProductStatus.ACTIVE,
      externalRef: 'TEST-PRODUCT-001',
      brandId: payload.brands.acme.id,
      categoryIds: [payload.categories.test.id],
      optionDefinitions: [{ key: 'color', label: 'Color', required: true, allowedValues: ['black'], componentType: 'select' }],
      skus: [
        {
          title: 'Default',
          sku: 'TEST-001',
          isDefault: true,
          options: { color: 'black' },
          availability: {
            ...availability,
            stock: { type: 'FINITE', quantity: 999 },
          },
          prices: [
            {
              priceListId: payload.priceList.id,
              unitPrice: 1000,
              minQuantity: 1,
            },
          ],
        },
      ],
      images: [
        { url: 'https://cdn.example.com/products/test/main.png', isPrimary: true },
      ],
      metaJson: { tags: ['test', 'seeded'] },
    });
  }
}
