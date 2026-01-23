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

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('Pricing Lock E2E', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let skuRepo: Repository<ProductSku>;
  let locationRepo: Repository<Location>;
  let orderRepo: Repository<Order>;
  let snapshotRepo: Repository<OrderPricingSnapshot>;
  let runRepo: Repository<PricingRun>;
  let jwtService: JwtService;
  let adminToken: string;

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

  it('locks pricing, sets lockedAt, and blocks repricing', async () => {
    const sku = await skuRepo
      .createQueryBuilder('s')
      .orderBy('s.created_at', 'ASC' as any)
      .getOne();
    expect(sku).toBeDefined();
    if (!sku) throw new Error('No SKU available (catalog seeder did not create any)');

    const kenya = await locationRepo.findOne({
      where: { type: LocationType.COUNTRY, countryCode: 'KE' },
    });
    expect(kenya).toBeDefined();

    const existingCustomer = await userRepo.findOne({
      where: { email: 'pricing-lock-e2e@example.com' },
    });
    const customer =
      existingCustomer ??
      (await userRepo.save(
        userRepo.create({
          email: 'pricing-lock-e2e@example.com',
          phone: '254700000099',
        } as any) as any,
      ));

    const payload = {
      customerId: customer.id,
      orderItems: [{ productSkuId: sku.id, quantity: 1 }],
      shippingLocationId: kenya!.id,
      shippingMethodCode: 'express',
    };

    const created = await request(app.getHttpServer())
      .post('/orders')
      .set(authHeader(adminToken))
      .send(payload)
      .expect(201);

    const orderId = created.body.data.id;

    // Force DRAFT so /orders/:id/reprice can run in this codebase.
    await orderRepo.update({ id: orderId } as any, { status: 'DRAFT' } as any);

    await request(app.getHttpServer())
      .post(`/orders/${orderId}/reprice`)
      .set(authHeader(adminToken))
      .send({ currency: 'KES', runtimeContext: { promoCodes: [] } })
      .expect(200);

    // lock-pricing only allows non-draft statuses
    await orderRepo.update(
      { id: orderId } as any,
      { status: 'ready_for_payment' } as any,
    );

    const lockRes = await request(app.getHttpServer())
      .post(`/orders/${orderId}/lock-pricing`)
      .set(authHeader(adminToken))
      .send({ clientIdempotencyKey: 'e2e-key-1' })
      .expect(200);

    expect(lockRes.body.data.orderId).toEqual(orderId);
    expect(lockRes.body.data.snapshot.lockedAt).toBeTruthy();
    expect(lockRes.body.data.status).toEqual('ready_for_payment');

    const repriceAgain = await request(app.getHttpServer())
      .post(`/orders/${orderId}/reprice`)
      .set(authHeader(adminToken))
      .send({ currency: 'KES' })
      .expect(409);

    expect(repriceAgain.body).toMatchObject({
      statusCode: 409,
      message: expect.anything(),
    });
    expect(repriceAgain.body.details?.code).toEqual('SNAPSHOT_LOCKED');
  }, 30000);

  it('fails lock-pricing if latest run is not SUCCEEDED', async () => {
    const sku = await skuRepo
      .createQueryBuilder('s')
      .orderBy('s.created_at', 'ASC' as any)
      .getOne();
    expect(sku).toBeDefined();
    if (!sku) throw new Error('No SKU available (catalog seeder did not create any)');

    const kenya = await locationRepo.findOne({
      where: { type: LocationType.COUNTRY, countryCode: 'KE' },
    });
    expect(kenya).toBeDefined();

    const existingCustomer = await userRepo.findOne({
      where: { email: 'pricing-lock-e2e-2@example.com' },
    });
    const customer =
      existingCustomer ??
      (await userRepo.save(
        userRepo.create({
          email: 'pricing-lock-e2e-2@example.com',
          phone: '254700000098',
        } as any) as any,
      ));

    const created = await request(app.getHttpServer())
      .post('/orders')
      .set(authHeader(adminToken))
      .send({
        customerId: customer.id,
        orderItems: [{ productSkuId: sku.id, quantity: 1 }],
        shippingLocationId: kenya!.id,
        shippingMethodCode: 'express',
      })
      .expect(201);

    const orderId = created.body.data.id;
    await orderRepo.update({ id: orderId } as any, { status: 'DRAFT' } as any);

    await request(app.getHttpServer())
      .post(`/orders/${orderId}/reprice`)
      .set(authHeader(adminToken))
      .send({ currency: 'KES' })
      .expect(200);

    const snapshot = await snapshotRepo.findOne({ where: { orderId } });
    expect(snapshot).toBeDefined();
    if (!snapshot) throw new Error('Snapshot not found');

    // Insert a newer FAILED run so it becomes the latest.
    await runRepo.save(
      runRepo.create({
        orderId,
        snapshotId: snapshot.id,
        idempotencyKey: `e2e_failed_${Date.now()}`,
        status: 'FAILED',
        engineVersion: snapshot.pricingEngineVersion,
        finishedAt: new Date(),
        error: { message: 'e2e forced fail' },
      } as any),
    );

    // lock-pricing only allows non-draft statuses
    await orderRepo.update(
      { id: orderId } as any,
      { status: 'ready_for_payment' } as any,
    );

    const lockRes = await request(app.getHttpServer())
      .post(`/orders/${orderId}/lock-pricing`)
      .set(authHeader(adminToken))
      .send({})
      .expect(409);

    expect(lockRes.body.details?.code).toEqual('PRICING_RUN_NOT_SUCCEEDED');
  }, 30000);

  it('rejects CAPTURE payments if quote is not locked', async () => {
    const sku = await skuRepo
      .createQueryBuilder('s')
      .orderBy('s.created_at', 'ASC' as any)
      .getOne();
    expect(sku).toBeDefined();
    if (!sku) throw new Error('No SKU available (catalog seeder did not create any)');

    const kenya = await locationRepo.findOne({
      where: { type: LocationType.COUNTRY, countryCode: 'KE' },
    });
    expect(kenya).toBeDefined();

    const existingCustomer = await userRepo.findOne({
      where: { email: 'pricing-lock-pay@example.com' },
    });
    const customer =
      existingCustomer ??
      (await userRepo.save(
        userRepo.create({
          email: 'pricing-lock-pay@example.com',
          phone: '254700000097',
        } as any) as any,
      ));

    const created = await request(app.getHttpServer())
      .post('/orders')
      .set(authHeader(adminToken))
      .send({
        customerId: customer.id,
        orderItems: [{ productSkuId: sku.id, quantity: 1 }],
        shippingLocationId: kenya!.id,
        shippingMethodCode: 'express',
      })
      .expect(201);

    const orderId = created.body.data.id;

    const payRes = await request(app.getHttpServer())
      .post(`/orders/${orderId}/payments`)
      .set(authHeader(adminToken))
      .send({
        type: 'CAPTURE',
        status: 'PENDING',
        provider: 'TEST',
        method: 'MANUAL',
        amount: 1,
        currency: 'KES',
        externalRef: `e2e_${Date.now()}`,
        initiatedAt: new Date().toISOString(),
      })
      .expect(409);

    expect(payRes.body.details?.code).toEqual('QUOTE_NOT_LOCKED');
  }, 30000);
});
