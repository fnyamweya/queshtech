import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import algoliasearch from 'algoliasearch';
import type { SearchClient } from 'algoliasearch';
import { Repository, In } from 'typeorm';
import { SettingService } from 'src/setting/services/setting.service';
import { Product } from '../entities/product.entity';
import { ProductSku } from '../entities/product-sku.entity';

export type AlgoliaCatalogProductRecord = {
  objectID: string;
  productId: string;
  slug: string;
  title: string;
  description?: string;
  status: string;
  externalRef?: string;
  brandId?: string;
  brandName?: string;
  categoryIds: string[];
  categoryNames: string[];
  skuIds: string[];
  skuCodes: string[];
  skuTitles: string[];
  optionValues: string[];
  tags: string[];
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
};

type AlgoliaCatalogConfig = {
  enabled: boolean;
  appId?: string;
  adminApiKey?: string;
  searchApiKey?: string;
  indexPrefix?: string;
  productsIndexName: string;
  indexSettingsJson?: Record<string, unknown>;
  searchParamsJson?: Record<string, unknown>;
  minQueryLength: number;
  debounceMs: number;
};

@Injectable()
export class AlgoliaCatalogService {
  private readonly logger = new Logger(AlgoliaCatalogService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly settingService: SettingService,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductSku)
    private readonly skuRepository: Repository<ProductSku>,
  ) {}

  private sanitizeIndexPart(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_\-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private buildIndexName(prefix: string | undefined, base: string): string {
    const b = this.sanitizeIndexPart(base || 'catalog_products');
    const p = this.sanitizeIndexPart(prefix || '');
    return p ? `${p}_${b}` : b;
  }

  private async getConfig(): Promise<AlgoliaCatalogConfig> {
    // Prefer DB settings (admin-configurable); fall back to env for bootstrap.
    const fromDb = await this.settingService.getAlgoliaCatalogSettingsInternalSafe();

    const enabledRaw =
      fromDb?.enabled ??
      (this.configService.get<string>('ALGOLIA_ENABLED') ?? '') === 'true';

    const productsIndexName =
      fromDb?.productsIndexName ??
      this.configService.get<string>('ALGOLIA_CATALOG_PRODUCTS_INDEX_NAME') ??
      'catalog_products';

    const cfg: AlgoliaCatalogConfig = {
      enabled: Boolean(enabledRaw),
      appId:
        fromDb?.appId ?? this.configService.get<string>('ALGOLIA_APP_ID') ?? undefined,
      adminApiKey:
        fromDb?.adminApiKey ??
        this.configService.get<string>('ALGOLIA_ADMIN_API_KEY') ??
        undefined,
      searchApiKey:
        fromDb?.searchApiKey ??
        this.configService.get<string>('ALGOLIA_SEARCH_API_KEY') ??
        undefined,
      indexPrefix:
        fromDb?.indexPrefix ??
        this.configService.get<string>('ALGOLIA_INDEX_PREFIX') ??
        undefined,
      productsIndexName,
      indexSettingsJson: fromDb?.indexSettingsJson ?? undefined,
      searchParamsJson: fromDb?.searchParamsJson ?? undefined,
      minQueryLength: fromDb?.minQueryLength ?? 2,
      debounceMs: fromDb?.debounceMs ?? 150,
    };

    return cfg;
  }

  private async getAdminClient(cfg: AlgoliaCatalogConfig): Promise<SearchClient | null> {
    if (!cfg.enabled) return null;
    if (!cfg.appId || !cfg.adminApiKey) return null;

    try {
      return algoliasearch(cfg.appId, cfg.adminApiKey);
    } catch (e: any) {
      this.logger.warn(`Failed to init Algolia client: ${e?.message ?? e}`);
      return null;
    }
  }

  private async getSearchClient(cfg: AlgoliaCatalogConfig): Promise<SearchClient | null> {
    if (!cfg.enabled) return null;
    if (!cfg.appId) return null;

    const key = cfg.searchApiKey || cfg.adminApiKey;
    if (!key) return null;

    try {
      return algoliasearch(cfg.appId, key);
    } catch (e: any) {
      this.logger.warn(`Failed to init Algolia search client: ${e?.message ?? e}`);
      return null;
    }
  }

  async searchPublicProducts(input: {
    q?: string;
    page?: number;
    limit?: number;
    filters?: string;
  }): Promise<
    | {
        indexName: string;
        hits: any[];
        nbHits: number;
        page: number;
        nbPages: number;
        hitsPerPage: number;
        processingTimeMS?: number;
        query?: string;
      }
    | null
  > {
    const cfg = await this.getConfig();
    const client = await this.getSearchClient(cfg);
    if (!client) return null;

    const indexName = this.buildIndexName(cfg.indexPrefix, cfg.productsIndexName);
    const index = client.initIndex(indexName);

    const page1 = Math.max(1, input.page ?? 1);
    const hitsPerPage = Math.max(1, Math.min(100, input.limit ?? 20));
    const page0 = page1 - 1;

    // Always enforce public visibility constraint.
    const publicFilter = 'status:active';
    const combinedFilters = input.filters
      ? `(${input.filters}) AND ${publicFilter}`
      : publicFilter;

    const baseParams =
      cfg.searchParamsJson && typeof cfg.searchParamsJson === 'object' && !Array.isArray(cfg.searchParamsJson)
        ? (cfg.searchParamsJson as Record<string, unknown>)
        : {};

    const params = {
      ...(baseParams as any),
      page: page0,
      hitsPerPage,
      filters: combinedFilters,
    } as any;

    const q = (input.q ?? '').trim();
    const res = await index.search(q, params);

    return {
      indexName,
      hits: (res as any).hits ?? [],
      nbHits: (res as any).nbHits ?? 0,
      page: ((res as any).page ?? 0) + 1,
      nbPages: (res as any).nbPages ?? 0,
      hitsPerPage: (res as any).hitsPerPage ?? hitsPerPage,
      processingTimeMS: (res as any).processingTimeMS,
      query: (res as any).query ?? q,
    };
  }

  async getPublicSearchConfig(): Promise<{
    enabled: boolean;
    appId?: string;
    searchApiKey?: string;
    indexName?: string;
    searchParamsJson?: Record<string, unknown>;
    minQueryLength: number;
    debounceMs: number;
  }> {
    const cfg = await this.getConfig();
    const indexName = this.buildIndexName(cfg.indexPrefix, cfg.productsIndexName);

    return {
      enabled: Boolean(cfg.enabled && cfg.appId && cfg.searchApiKey && indexName),
      appId: cfg.appId,
      searchApiKey: cfg.searchApiKey,
      indexName,
      searchParamsJson: cfg.searchParamsJson ?? {},
      minQueryLength: cfg.minQueryLength,
      debounceMs: cfg.debounceMs,
    };
  }

  private productToAlgoliaRecord(product: Product): AlgoliaCatalogProductRecord {
    const skus = product.skus ?? [];

    const skuIds = skus.map((s) => s.id);
    const skuCodes = skus.map((s) => s.sku).filter(Boolean);
    const skuTitles = skus.map((s) => s.title).filter(Boolean);

    const optionValues: string[] = [];
    for (const s of skus) {
      const options = (s.options ?? {}) as Record<string, string>;
      for (const [k, v] of Object.entries(options)) {
        if (k) optionValues.push(String(k));
        if (v) optionValues.push(String(v));
      }
    }

    const tags = Array.isArray((product.metaJson as any)?.tags)
      ? (product.metaJson as any).tags.map((t: any) => String(t).trim()).filter(Boolean)
      : [];

    const categories = product.productCategories ?? [];
    const categoryIds = categories.map((pc: any) => pc.categoryId).filter(Boolean);
    const categoryNames = categories
      .map((pc: any) => {
        const c = pc.category;
        if (!c) return null;
        const translations = c.translations ?? [];
        const t = translations.find((x: any) => (x.locale || '').toLowerCase() === 'en') ?? translations[0];
        return t?.name ?? c.key;
      })
      .filter(Boolean) as string[];

    const defaultSku = skus.find((s) => Boolean((s as any).isDefault)) ?? skus[0];
    const imageUrl = (defaultSku?.imagesJson ?? []).find(Boolean) ?? undefined;

    return {
      objectID: product.id,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description ?? undefined,
      status: product.status,
      externalRef: product.externalRef ?? undefined,
      brandId: product.brandId ?? undefined,
      brandName: product.brand?.name ?? undefined,
      categoryIds,
      categoryNames,
      skuIds,
      skuCodes,
      skuTitles,
      optionValues,
      tags,
      imageUrl,
      createdAt: product.createdAt ? new Date(product.createdAt).getTime() : Date.now(),
      updatedAt: product.updatedAt ? new Date(product.updatedAt).getTime() : Date.now(),
    };
  }

  async applyIndexSettings(): Promise<{ indexName: string } | null> {
    const cfg = await this.getConfig();
    const client = await this.getAdminClient(cfg);
    if (!client) return null;

    const indexName = this.buildIndexName(cfg.indexPrefix, cfg.productsIndexName);
    const index = client.initIndex(indexName);

    const settings = cfg.indexSettingsJson ?? {};
    await index.setSettings(settings as any);
    return { indexName };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const cfg = await this.getConfig();
    if (!cfg.enabled) return { ok: false, message: 'Algolia is disabled.' };
    if (!cfg.appId) return { ok: false, message: 'Missing Algolia appId.' };
    if (!cfg.adminApiKey) return { ok: false, message: 'Missing Algolia admin API key.' };

    const client = await this.getAdminClient(cfg);
    if (!client) return { ok: false, message: 'Failed to initialize Algolia client.' };

    try {
      // Lightweight check: list indices.
      await (client as any).listIndices();
      return { ok: true, message: 'Algolia connection OK.' };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? 'Algolia connection failed.' };
    }
  }

  async indexProduct(productId: string): Promise<void> {
    const cfg = await this.getConfig();
    const client = await this.getAdminClient(cfg);
    if (!client) return;

    const indexName = this.buildIndexName(cfg.indexPrefix, cfg.productsIndexName);
    const index = client.initIndex(indexName);

    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: [
        'brand',
        'skus',
        'productCategories',
        'productCategories.category',
        'productCategories.category.translations',
      ],
    });

    if (!product) return;

    const record = this.productToAlgoliaRecord(product);
    await index.partialUpdateObject(record as any, { createIfNotExists: true });
  }

  async deleteProduct(productId: string): Promise<void> {
    const cfg = await this.getConfig();
    const client = await this.getAdminClient(cfg);
    if (!client) return;

    const indexName = this.buildIndexName(cfg.indexPrefix, cfg.productsIndexName);
    const index = client.initIndex(indexName);
    await index.deleteObject(productId);
  }

  async reindexAll(options?: { batchSize?: number }): Promise<{ indexed: number } | null> {
    const cfg = await this.getConfig();
    const client = await this.getAdminClient(cfg);
    if (!client) return null;

    const indexName = this.buildIndexName(cfg.indexPrefix, cfg.productsIndexName);
    const index = client.initIndex(indexName);

    const batchSize = Math.max(1, Math.min(1000, options?.batchSize ?? 500));

    const ids = await this.productRepository.find({
      select: ['id'],
      order: { updatedAt: 'DESC' as any },
    });

    const productIds = ids.map((p) => p.id);
    let indexed = 0;

    for (let i = 0; i < productIds.length; i += batchSize) {
      const chunk = productIds.slice(i, i + batchSize);
      const products = await this.productRepository.find({
        where: { id: In(chunk) },
        relations: [
          'brand',
          'skus',
          'productCategories',
          'productCategories.category',
          'productCategories.category.translations',
        ],
      });

      const records = products.map((p) => this.productToAlgoliaRecord(p));
      if (records.length) {
        await index.saveObjects(records as any, { autoGenerateObjectIDIfNotExist: false });
        indexed += records.length;
      }
    }

    return { indexed };
  }
}
