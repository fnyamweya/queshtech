import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { AppCacheService } from './app-cache.service';
import { PriceResolveCacheIndexService } from './price-resolve-cache-index.service';
import { ShippingCatalogContextCacheIndexService } from './shipping-catalog-context-cache-index.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [AppCacheService, ShippingCatalogContextCacheIndexService, PriceResolveCacheIndexService],
  exports: [AppCacheService, ShippingCatalogContextCacheIndexService, PriceResolveCacheIndexService],
})
export class AppCacheModule {}
