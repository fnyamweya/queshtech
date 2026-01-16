import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class PriceResolveCacheIndexService {
  private readonly logger = new Logger(PriceResolveCacheIndexService.name);
  private readonly idxPrefix = 'price:resolve:idx:';

  constructor(private readonly redisService: RedisService) {}

  private productIndexKey(productId: string): string {
    return `${this.idxPrefix}product:${String(productId)}`;
  }

  private skuIndexKey(skuId: string): string {
    return `${this.idxPrefix}sku:${String(skuId)}`;
  }

  async indexCacheKey(
    cacheKey: string,
    ctx: { productId?: string; skuId?: string },
    ttlSeconds: number,
  ): Promise<void> {
    const redis = this.redisService.getClient();

    const productId = ctx.productId ? String(ctx.productId) : '';
    const skuId = ctx.skuId ? String(ctx.skuId) : '';

    const indexKeys: string[] = [];
    if (productId) indexKeys.push(this.productIndexKey(productId));
    if (skuId) indexKeys.push(this.skuIndexKey(skuId));
    if (!indexKeys.length) return;

    // Keep the index around longer than the cache entry.
    const indexTtlSeconds = Math.max(3600, ttlSeconds * 4);

    try {
      const pipeline = redis.pipeline();
      for (const idxKey of indexKeys) {
        pipeline.sadd(idxKey, cacheKey);
        pipeline.expire(idxKey, indexTtlSeconds);
      }
      await pipeline.exec();
    } catch (err: any) {
      this.logger.debug(
        `Index write failed (${cacheKey}): ${err?.message ?? 'unknown error'}`,
      );
    }
  }

  async invalidateByProductIds(productIds: string[]): Promise<void> {
    const keys = Array.from(new Set(productIds.map(String))).map((id) =>
      this.productIndexKey(id),
    );
    await this.invalidateByIndexKeys(keys);
  }

  async invalidateBySkuIds(skuIds: string[]): Promise<void> {
    const keys = Array.from(new Set(skuIds.map(String))).map((id) =>
      this.skuIndexKey(id),
    );
    await this.invalidateByIndexKeys(keys);
  }

  private async invalidateByIndexKeys(indexKeys: string[]): Promise<void> {
    if (!indexKeys.length) return;

    const redis = this.redisService.getClient();

    try {
      const pipeline = redis.pipeline();
      for (const idxKey of indexKeys) pipeline.smembers(idxKey);
      const results = await pipeline.exec();

      const cacheKeys = new Set<string>();
      for (const [err, members] of results ?? []) {
        if (err) continue;
        for (const k of (members as string[]) ?? []) cacheKeys.add(String(k));
      }

      const cacheKeyList = Array.from(cacheKeys);
      if (cacheKeyList.length) {
        for (let i = 0; i < cacheKeyList.length; i += 500) {
          await redis.del(...cacheKeyList.slice(i, i + 500));
        }
      }

      for (let i = 0; i < indexKeys.length; i += 500) {
        await redis.del(...indexKeys.slice(i, i + 500));
      }
    } catch (err: any) {
      this.logger.debug(
        `Index invalidate failed (${indexKeys[0]}): ${err?.message ?? 'unknown error'}`,
      );
    }
  }
}
