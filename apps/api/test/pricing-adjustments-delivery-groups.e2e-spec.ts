import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

import { createTestApp, truncateDb } from './e2e/bootstrap';
import { User } from '../src/user/entities/user.entity';
import { ProductSku } from '../src/catalog/entities/product-sku.entity';
import { Location, LocationType } from '../src/location/entities/location.entity';
import { Order } from '../src/order/entities/order.entity';
import { OrderPricingSnapshot } from '../src/pricing/entities/order-pricing-snapshot.entity';
import { PricingRun } from '../src/pricing/entities/pricing-run.entity';
import { Batch, BatchItem } from '../src/order/batches/entities';

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('Pricing Adjustments + Delivery Groups E2E', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let skuRepo: Repository<ProductSku>;
  let locationRepo: Repository<Location>;
  let orderRepo: Repository<Order>;
  let snapshotRepo: Repository<OrderPricingSnapshot>;
  let runRepo: Repository<PricingRun>;
  let batchRepo: Repository<Batch>;
  let batchItemRepo: Repository<BatchItem>;
  let jwtService: JwtService;
  let adminToken: string;
  let phoneCounter = 90;

  beforeAll(async () => {
    const t = await createTestApp();
    app = t.app;

    await truncateDb(t.ds);

    const settingSeeder = app.get(
      require('../src/setting/seeders/setting.seeder').SettingSeeder,
    );
    const channelsSeeder = app.get(
      require('../src/channels/seeders/channels.seeder').ChannelsSeeder,
    );
    const authSeeder = app.get(require('../src/auth/seeders/auth.seeder').AuthSeeder);
    const catalogSeeder = app.get(
      require('../src/catalog/seeders/catalog.seeder').CatalogSeeder,
    );
    const pricebookSeeder = app.get(
      require('../src/pricing/seeders/pricebook.seeder').PricebookSeeder,
    );
    const shippingSeeder = app.get(
      require('../src/shipping/seeders/shipping.seeder').ShippingSeeder,
    );
    const locationSeeder = app.get(
      require('../src/location/seeders/location.seeder').LocationSeeder,
    );

    await settingSeeder.seed();
    await locationSeeder.seed();
    await channelsSeeder.seed();
    await authSeeder.seed();
    await catalogSeeder.seed();
    await pricebookSeeder.seed();
    await shippingSeeder.seed();

    userRepo = app.get(getRepositoryToken(User));
    skuRepo = app.get(getRepositoryToken(ProductSku));
    locationRepo = app.get(getRepositoryToken(Location));
    orderRepo = app.get(getRepositoryToken(Order));
    snapshotRepo = app.get(getRepositoryToken(OrderPricingSnapshot));
    runRepo = app.get(getRepositoryToken(PricingRun));
    batchRepo = app.get(getRepositoryToken(Batch));
    batchItemRepo = app.get(getRepositoryToken(BatchItem));

    jwtService = app.get(JwtService);
    const admin = await userRepo.findOne({ where: { email: 'admin@example.com' } });
    if (!admin) throw new Error('Seeded admin user not found');
    adminToken = jwtService.sign({
      sub: admin.id,
      userId: admin.id,
      roleId: (admin as any).roleId ?? '',
    } as any);
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
  });

  async function createOrderForPricing(email: string): Promise<string> {
    const sku = await skuRepo
      .createQueryBuilder('s')
      .orderBy('s.created_at', 'ASC' as any)
      .getOne();
    if (!sku) throw new Error('No SKU available (catalog seeder did not create any)');

    const kenya = await locationRepo.findOne({
      where: { type: LocationType.COUNTRY, countryCode: 'KE' },
    });
    if (!kenya) throw new Error('Seeded Kenya location not found');

    const existingCustomer = await userRepo.findOne({ where: { email } });
    const customer =
      existingCustomer ??
      (await userRepo.save(
        userRepo.create({
          email,
          phone: `254700000${phoneCounter++}`,
        } as any) as any,
      ));

    const created = await request(app.getHttpServer())
      .post('/orders')
      .set(authHeader(adminToken))
      .send({
        customerId: customer.id,
        orderItems: [{ productSkuId: sku.id, quantity: 1 }],
        shippingLocationId: kenya.id,
        shippingMethodCode: 'express',
      })
      .expect(201);

    return created.body.data.id;
  }

  it('applies append-only adjustments and reflects them in pricing artifacts', async () => {
    const orderId = await createOrderForPricing('pricing-adjustments-e2e@example.com');

    await orderRepo.update({ id: orderId } as any, { status: 'DRAFT' } as any);

    await request(app.getHttpServer())
      .post(`/orders/${orderId}/reprice`)
      .set(authHeader(adminToken))
      .send({ currency: 'KES', runtimeContext: { promoCodes: [] } })
      .expect(200);

    await orderRepo.update({ id: orderId } as any, { status: 'ready_for_payment' } as any);

    await request(app.getHttpServer())
      .post(`/orders/${orderId}/lock-pricing`)
      .set(authHeader(adminToken))
      .send({})
      .expect(200);

    const before = await orderRepo.findOne({ where: { id: orderId } });
    expect(before).toBeDefined();

    const beforeFee = Number(before!.feeTotal || 0);
    const beforeGrand = Number(before!.grandTotal || 0);

    await request(app.getHttpServer())
      .post(`/orders/${orderId}/pricing-adjustments`)
      .set(authHeader(adminToken))
      .send({
        clientIdempotencyKey: 'e2e-adj-1',
        adjustments: [{ amount: 100, reason: 'manual_adjustment', displayName: 'Manual correction' }],
      })
      .expect(200);

    const after1 = await orderRepo.findOne({ where: { id: orderId } });
    expect(Number(after1!.feeTotal || 0)).toBeCloseTo(beforeFee + 100, 4);
    expect(Number(after1!.grandTotal || 0)).toBeCloseTo(beforeGrand + 100, 4);

    await request(app.getHttpServer())
      .post(`/orders/${orderId}/pricing-adjustments`)
      .set(authHeader(adminToken))
      .send({
        clientIdempotencyKey: 'e2e-adj-2',
        adjustments: [{ amount: -25, reason: 'manual_adjustment', displayName: 'Negative correction' }],
      })
      .expect(200);

    const after2 = await orderRepo.findOne({ where: { id: orderId } });
    expect(Number(after2!.feeTotal || 0)).toBeCloseTo(beforeFee + 75, 4);
    expect(Number(after2!.grandTotal || 0)).toBeCloseTo(beforeGrand + 75, 4);

    const pricing = await request(app.getHttpServer())
      .get(`/orders/${orderId}/pricing`)
      .set(authHeader(adminToken))
      .expect(200);

    const charges = pricing.body.data.charges ?? [];
    expect(charges.some((c: any) => c.chargeType === 'BASE')).toBe(true);
    expect(charges.filter((c: any) => c.chargeType === 'ADJUSTMENT').length).toBeGreaterThanOrEqual(2);

    const adjustmentRuns = await runRepo.find({ where: { orderId, kind: 'ADJUSTMENT' as any } as any });
    expect(adjustmentRuns.length).toBeGreaterThanOrEqual(2);
  }, 45000);

  it('rejects pricing adjustments when snapshot is not locked', async () => {
    const orderId = await createOrderForPricing('pricing-adjustments-unlocked@example.com');

    await orderRepo.update({ id: orderId } as any, { status: 'DRAFT' } as any);

    await request(app.getHttpServer())
      .post(`/orders/${orderId}/reprice`)
      .set(authHeader(adminToken))
      .send({ currency: 'KES' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post(`/orders/${orderId}/pricing-adjustments`)
      .set(authHeader(adminToken))
      .send({ adjustments: [{ amount: 10, reason: 'manual_adjustment' }] })
      .expect(409);

    expect(res.body.details?.code).toEqual('SNAPSHOT_NOT_LOCKED');
  }, 30000);

  it('resolves delivery groups and persists runtimeContext + tables', async () => {
    const orderId = await createOrderForPricing('delivery-groups-e2e@example.com');

    await orderRepo.update({ id: orderId } as any, { status: 'DRAFT' } as any);

    await request(app.getHttpServer())
      .post(`/orders/${orderId}/reprice`)
      .set(authHeader(adminToken))
      .send({ currency: 'KES' })
      .expect(200);

    const resolve = await request(app.getHttpServer())
      .post(`/orders/${orderId}/batches/resolve`)
      .set(authHeader(adminToken))
      .send({ warehouseGrouping: 'SINGLE' })
      .expect(200);

    expect(resolve.body.data.orderId).toEqual(orderId);
    expect(Array.isArray(resolve.body.data.batches)).toBe(true);
    expect(resolve.body.data.batches.length).toBe(1);

    const snapshot = await snapshotRepo.findOne({ where: { orderId } });
    expect(snapshot).toBeDefined();
    expect((snapshot!.runtimeContext as any)?.batches?.length).toBe(1);

    const batch = await batchRepo.findOne({ where: { orderId } });
    expect(batch).toBeDefined();

    const items = await orderRepo.findOne({ where: { id: orderId }, relations: ['items'] });
    const expectedCount = (items!.items ?? []).filter((it: any) => !!it.requiresShipping).length;

    const rows = await batchItemRepo.find({ where: { batchId: batch!.id } });
    expect(rows.length).toBe(expectedCount);
  }, 45000);
});
