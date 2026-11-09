import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '../generated/prisma/client.js';
import {
  consumeReservation,
  releaseReservation,
  type OrdersInventoryTransaction,
} from './orders.inventory.js';
import type { OrdersExpirationService as ExpirationType } from './orders.expiration.service.js';
import type { AuthService as AuthServiceType } from '../auth/auth.service.js';

/**
 * Real-PostgreSQL integration tests (Phát, steps 4-8).
 * Run ONLY against a dedicated PostgreSQL test database that has had
 * `prisma migrate deploy` applied:
 *   RUN_DB_INTEGRATION=1 npm test -- src/orders/orders.integration.spec.ts
 * Every row is created by the test and deleted in afterAll; nothing is TRUNCATEd.
 * The two topping ingredients (Trân châu, Kem sữa) are looked up by name by the
 * app, so the test reuses them if they exist and restores their stock/reserved.
 */
const integrationEnabled = process.env.RUN_DB_INTEGRATION === '1';
type Stock = { stock: number; reserved: number };
const asTx = (tx: unknown) => tx as OrdersInventoryTransaction;

describe.skipIf(!integrationEnabled)(
  'Phat: recipe ingredient inventory + Orders API integration',
  () => {
    let app!: INestApplication;
    let prisma!: PrismaClient;
    let expiration!: ExpirationType;
    let auth!: AuthServiceType;
    const userIds: number[] = [];
    const recipeIds: number[] = [];
    const ingredientIds: number[] = [];
    const productIds: number[] = [];
    const toppingBackup: Array<{ id: number; stock: number; reserved: number }> = [];

    beforeAll(async () => {
      if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
        throw new Error('Set DATABASE_URL and JWT_SECRET in apps/api/.env before integration testing');
      }
      const { AppModule } = await import('../app.module.js');
      const { OrdersExpirationService } = await import('./orders.expiration.service.js');
      const { AuthService } = await import('../auth/auth.service.js');
      const testingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
      app = testingModule.createNestApplication();
      await app.init();
      expiration = testingModule.get(OrdersExpirationService);
      auth = testingModule.get(AuthService);
      prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      });
    });

    afterAll(async () => {
      if (prisma) {
        // Orders first: OrderItem/OrderIngredient cascade, Recipe/Ingredient/Product are Restrict.
        for (const userId of userIds) {
          await prisma.$executeRaw`DELETE FROM "Order" WHERE "userId" = ${userId}`;
        }
        for (const id of recipeIds) {
          await prisma.$executeRaw`DELETE FROM "RecipeIngredient" WHERE "recipeId" = ${id}`;
          await prisma.$executeRaw`DELETE FROM "Recipe" WHERE "id" = ${id}`;
        }
        for (const id of ingredientIds) {
          await prisma.$executeRaw`DELETE FROM "Ingredient" WHERE "id" = ${id}`;
        }
        for (const t of toppingBackup) {
          await prisma.$executeRaw`
            UPDATE "Ingredient" SET "stock" = ${t.stock}, "reserved" = ${t.reserved} WHERE "id" = ${t.id}
          `;
        }
        for (const id of productIds) {
          await prisma.$executeRaw`DELETE FROM "Product" WHERE "id" = ${id}`;
        }
        for (const id of userIds) {
          await prisma.$executeRaw`DELETE FROM "User" WHERE "id" = ${id}`;
        }
        await prisma.$disconnect();
      }
      if (app) await app.close();
    });

    // ---------- fixtures ----------
    async function createUserAndLogin(role: 'CUSTOMER' | 'ADMIN' = 'CUSTOMER') {
      const email = `orders-it-${randomUUID()}@example.test`;
      const password = 'IntegrationTest123!';
      // These are Orders fixtures, not auth-rate tests: provision via the real
      // service so many fixture users do not exhaust one localhost IP bucket.
      // Orders HTTP requests below still exercise the real JWT/DB role guards.
      const registered = await auth.register({ email, password });
      const id = registered.id;
      userIds.push(id);
      if (role === 'ADMIN') {
        // Role lives in the DB only; the login token carries just `sub`.
        await prisma.$executeRaw`UPDATE "User" SET "role" = 'ADMIN' WHERE "id" = ${id}`;
      }
      const login = await auth.login({ email, password });
      return { id, email, token: login.accessToken };
    }

    async function createIngredient(name: string, unit: 'g' | 'ml', stock: number) {
      const rows = await prisma.$queryRaw<Array<{ id: number }>>`
        INSERT INTO "Ingredient" ("name", "unit", "stock", "reserved", "minStock", "version")
        VALUES (${name}, ${unit}, ${stock}, 0, 0, 0) RETURNING "id"
      `;
      const id = Number(rows[0]?.id);
      if (!id) throw new Error(`Could not create ingredient ${name}`);
      ingredientIds.push(id);
      return id;
    }

    /** Topping ingredients are resolved by name inside the app. */
    async function ensureTopping(name: 'Trân châu' | 'Kem sữa', unit: 'g' | 'ml', stock: number) {
      const found = await prisma.$queryRaw<Array<{ id: number; stock: number; reserved: number }>>`
        SELECT "id", "stock", "reserved" FROM "Ingredient" WHERE LOWER("name") = LOWER(${name})
      `;
      if (found[0]) {
        const id = Number(found[0].id);
        toppingBackup.push({ id, stock: Number(found[0].stock), reserved: Number(found[0].reserved) });
        await prisma.$executeRaw`
          UPDATE "Ingredient" SET "stock" = ${stock}, "reserved" = 0, "unit" = ${unit} WHERE "id" = ${id}
        `;
        return id;
      }
      return createIngredient(name, unit, stock);
    }

    async function createRecipe(name: string, price: number, lines: Array<[number, number]>) {
      const rows = await prisma.$queryRaw<Array<{ id: number }>>`
        INSERT INTO "Recipe" ("name", "price", "imageUrl", "isActive")
        VALUES (${name}, ${price}, '/integration-test.svg', TRUE) RETURNING "id"
      `;
      const id = Number(rows[0]?.id);
      if (!id) throw new Error(`Could not create recipe ${name}`);
      recipeIds.push(id);
      for (const [ingredientId, quantity] of lines) {
        await prisma.$executeRaw`
          INSERT INTO "RecipeIngredient" ("recipeId", "ingredientId", "quantity")
          VALUES (${id}, ${ingredientId}, ${quantity})
        `;
      }
      return id;
    }

    async function inv(id: number): Promise<Stock> {
      const rows = await prisma.$queryRaw<Stock[]>`
        SELECT "stock", "reserved" FROM "Ingredient" WHERE "id" = ${id}
      `;
      return { stock: Number(rows[0]?.stock), reserved: Number(rows[0]?.reserved) };
    }

    async function orderState(orderId: number) {
      const order = await prisma.$queryRaw<Array<{ status: string }>>`
        SELECT "status" FROM "Order" WHERE "id" = ${orderId}
      `;
      const rows = await prisma.$queryRaw<Array<{ ingredientId: number; quantity: number; status: string }>>`
        SELECT "ingredientId", "quantity", "status" FROM "OrderIngredient"
        WHERE "orderId" = ${orderId} ORDER BY "ingredientId"
      `;
      return {
        status: order[0]?.status,
        rows: rows.map((r) => ({
          ingredientId: Number(r.ingredientId), quantity: Number(r.quantity), status: r.status,
        })),
      };
    }

    const post = (token: string, body: unknown, key?: string) => {
      const req = request(app.getHttpServer()).post('/orders').set('Authorization', `Bearer ${token}`);
      if (key) req.set('Idempotency-Key', key);
      const payload = body && typeof body === 'object' && !Array.isArray(body)
        ? { recipientName: 'Integration Customer', recipientPhone: '0901234567', ...(body as Record<string, unknown>) }
        : body;
      return req.send(payload as object);
    };
    const item = (productId: number, quantity: number, size: 'S' | 'M' | 'L' = 'M', toppings: string[] = []) =>
      ({ productId, quantity, size, toppings });

    async function expireNow(orderId: number) {
      await prisma.$executeRaw`
        UPDATE "Order" SET "expiresAt" = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE "id" = ${orderId}
      `;
    }

    // ---------- Step 5: create order ----------
    describe('create order', () => {
      it('computes size ceil + toppings, merges shared ingredients, reserves without touching stock', async () => {
        const user = await createUserAndLogin();
        const pearl = await ensureTopping('Trân châu', 'g', 1000);
        const cream = await ensureTopping('Kem sữa', 'ml', 1000);
        const coffee = await createIngredient(`Coffee-${randomUUID()}`, 'g', 1000);
        const milk = await createIngredient(`Milk-${randomUUID()}`, 'ml', 1000);
        // Size M quantities: 7 g coffee, 30 ml milk.
        const a = await createRecipe(`A-${randomUUID()}`, 25000, [[coffee, 7], [milk, 30]]);
        // Shares coffee with recipe A.
        const b = await createRecipe(`B-${randomUUID()}`, 30000, [[coffee, 10]]);

        const created = await post(user.token, {
          items: [
            item(a, 2, 'L', ['PEARL', 'CREAM']), // coffee ceil(8.4)=9 x2=18 ; milk ceil(36)=36 x2=72 ; +40 pearl, +40 cream
            item(a, 1, 'S'),                     // coffee ceil(5.6)=6 ; milk ceil(24)=24
            item(b, 3, 'M', ['PEARL']),          // coffee 10 x3=30 ; +60 pearl
          ],
        }).expect(201);
        expect(created.body).toMatchObject({ status: 'PENDING' });

        const state = await orderState(created.body.orderId);
        expect(state.status).toBe('PENDING');
        const byIngredient = new Map(state.rows.map((r) => [r.ingredientId, r]));
        expect(state.rows).toHaveLength(4); // one merged row per ingredient
        expect(byIngredient.get(coffee)).toMatchObject({ quantity: 18 + 6 + 30, status: 'RESERVED' });
        expect(byIngredient.get(milk)).toMatchObject({ quantity: 72 + 24, status: 'RESERVED' });
        expect(byIngredient.get(pearl)).toMatchObject({ quantity: 40 + 60, status: 'RESERVED' });
        expect(byIngredient.get(cream)).toMatchObject({ quantity: 40, status: 'RESERVED' });

        expect(await inv(coffee)).toEqual({ stock: 1000, reserved: 54 });
        expect(await inv(milk)).toEqual({ stock: 1000, reserved: 96 });
        expect(await inv(pearl)).toEqual({ stock: 1000, reserved: 100 });
        expect(await inv(cream)).toEqual({ stock: 1000, reserved: 40 });
      });

      it('creates nothing and holds nothing when one ingredient is short', async () => {
        const user = await createUserAndLogin();
        const plenty = await createIngredient(`Plenty-${randomUUID()}`, 'g', 1000);
        const scarce = await createIngredient(`Scarce-${randomUUID()}`, 'g', 10);
        const recipe = await createRecipe(`Short-${randomUUID()}`, 25000, [[plenty, 20], [scarce, 20]]);
        const before = await prisma.$queryRaw<Array<{ n: bigint }>>`
          SELECT COUNT(*) AS n FROM "Order" WHERE "userId" = ${user.id}
        `;

        const res = await post(user.token, { items: [item(recipe, 1)] });
        expect(res.status).toBe(400);

        const after = await prisma.$queryRaw<Array<{ n: bigint }>>`
          SELECT COUNT(*) AS n FROM "Order" WHERE "userId" = ${user.id}
        `;
        expect(Number(after[0]?.n)).toBe(Number(before[0]?.n));
        expect(await inv(plenty)).toEqual({ stock: 1000, reserved: 0 });
        expect(await inv(scarce)).toEqual({ stock: 10, reserved: 0 });
      });

      it('replays an identical idempotent request once and rejects the same key with a different body (409)', async () => {
        const user = await createUserAndLogin();
        const ing = await createIngredient(`Idem-${randomUUID()}`, 'g', 1000);
        const recipe = await createRecipe(`Idem-${randomUUID()}`, 25000, [[ing, 20]]);
        const key = `orders-${randomUUID()}`;
        const body = { items: [item(recipe, 2)] };

        const first = await post(user.token, body, key).expect(201);
        const replay = await post(user.token, body, key).expect(201);
        expect(replay.body.orderId).toBe(first.body.orderId);
        expect(await inv(ing)).toEqual({ stock: 1000, reserved: 40 });
        await post(user.token, { items: [item(recipe, 1)] }, key).expect(409);
        expect(await inv(ing)).toEqual({ stock: 1000, reserved: 40 });
      });

      it('stores a snapshot that later recipe edits do not change', async () => {
        const user = await createUserAndLogin();
        const ing = await createIngredient(`Snap-${randomUUID()}`, 'g', 1000);
        const name = `Snap-${randomUUID()}`;
        const recipe = await createRecipe(name, 25000, [[ing, 20]]);
        const created = await post(user.token, { items: [item(recipe, 2)] }).expect(201);

        await prisma.$executeRaw`
          UPDATE "Recipe" SET "name" = ${name + '-renamed'}, "price" = 99000, "isActive" = FALSE WHERE "id" = ${recipe}
        `;
        await prisma.$executeRaw`
          UPDATE "RecipeIngredient" SET "quantity" = 500 WHERE "recipeId" = ${recipe}
        `;

        const detail = await request(app.getHttpServer())
          .get(`/orders/${created.body.orderId}`)
          .set('Authorization', `Bearer ${user.token}`)
          .expect(200);
        expect(detail.body.items[0]).toMatchObject({ recipeName: name, unitPrice: 25000, subtotal: 50000, quantity: 2 });
        const state = await orderState(created.body.orderId);
        expect(state.rows).toEqual([{ ingredientId: ing, quantity: 40, status: 'RESERVED' }]);
      });
    });

    // ---------- Step 6: concurrency ----------
    describe('concurrency', () => {
      it('lets at most one of two different-key requests win when only one fits', async () => {
        const [a, b] = [await createUserAndLogin(), await createUserAndLogin()];
        const ing = await createIngredient(`Limited-${randomUUID()}`, 'g', 50);
        const recipe = await createRecipe(`Limited-${randomUUID()}`, 25000, [[ing, 20]]);
        const body = { items: [item(recipe, 2)] };

        const responses = await Promise.all([
          post(a.token, body, `race-a-${randomUUID()}`),
          post(b.token, body, `race-b-${randomUUID()}`),
        ]);
        expect(responses.map((r) => r.status).sort((x, y) => x - y)).toEqual([201, 400]);
        const final = await inv(ing);
        expect(final).toEqual({ stock: 50, reserved: 40 });
        expect(final.reserved).toBeLessThanOrEqual(final.stock);
      });

      it('holds the invariant when two recipes share one ingredient', async () => {
        const [a, b] = [await createUserAndLogin(), await createUserAndLogin()];
        const shared = await createIngredient(`Shared-${randomUUID()}`, 'g', 50);
        const r1 = await createRecipe(`S1-${randomUUID()}`, 25000, [[shared, 20]]);
        const r2 = await createRecipe(`S2-${randomUUID()}`, 26000, [[shared, 20]]);

        const responses = await Promise.all([
          post(a.token, { items: [item(r1, 2)] }, `s1-${randomUUID()}`),
          post(b.token, { items: [item(r2, 2)] }, `s2-${randomUUID()}`),
        ]);
        expect(responses.map((r) => r.status).sort((x, y) => x - y)).toEqual([201, 400]);
        expect(await inv(shared)).toEqual({ stock: 50, reserved: 40 });
        const reserved = await prisma.$queryRaw<Array<{ total: bigint | null }>>`
          SELECT SUM("quantity") AS total FROM "OrderIngredient"
          WHERE "ingredientId" = ${shared} AND "status" = 'RESERVED'
        `;
        expect(Number(reserved[0]?.total)).toBe(40);
      });

      it('creates one order and one reservation for two parallel retries with the same key', async () => {
        const user = await createUserAndLogin();
        const ing = await createIngredient(`Retry-${randomUUID()}`, 'g', 1000);
        const recipe = await createRecipe(`Retry-${randomUUID()}`, 25000, [[ing, 20]]);
        const key = `retry-${randomUUID()}`;
        const body = { items: [item(recipe, 1)] };

        const responses = await Promise.all([post(user.token, body, key), post(user.token, body, key)]);
        expect(responses.map((r) => r.status)).toEqual([201, 201]);
        expect(responses[0]!.body.orderId).toBe(responses[1]!.body.orderId);
        const orders = await prisma.$queryRaw<Array<{ n: bigint }>>`
          SELECT COUNT(*) AS n FROM "Order" WHERE "userId" = ${user.id} AND "idempotencyKey" = ${key}
        `;
        expect(Number(orders[0]?.n)).toBe(1);
        expect(await inv(ing)).toEqual({ stock: 1000, reserved: 20 });
      });
    });

    // ---------- Step 7: consume / release / expiry ----------
    describe('consume, release and expiry', () => {
      async function pendingOrder(quantity = 2, stock = 100) {
        const user = await createUserAndLogin();
        const ing = await createIngredient(`Inv-${randomUUID()}`, 'g', stock);
        const recipe = await createRecipe(`Inv-${randomUUID()}`, 25000, [[ing, 20]]);
        const created = await post(user.token, { items: [item(recipe, quantity)] }).expect(201);
        return { user, ing, recipe, orderId: created.body.orderId as number };
      }

      it('consumes exactly once, also under parallel duplicate calls', async () => {
        const { ing, orderId } = await pendingOrder(); // reserves 40
        const results = await Promise.allSettled([
          prisma.$transaction((tx) => consumeReservation(asTx(tx), orderId)),
          prisma.$transaction((tx) => consumeReservation(asTx(tx), orderId)),
        ]);
        const values = results.map((r) => (r.status === 'fulfilled' ? r.value : `ERR:${String(r.reason)}`));
        expect(values.filter((v) => v === 'CONSUMED')).toHaveLength(1);
        expect(values.filter((v) => v === 'ALREADY_CONSUMED')).toHaveLength(1);
        expect(await inv(ing)).toEqual({ stock: 60, reserved: 0 });
        expect(await orderState(orderId)).toMatchObject({ status: 'PAID', rows: [{ status: 'CONSUMED' }] });

        // A later duplicate stays a no-op.
        expect(await prisma.$transaction((tx) => consumeReservation(asTx(tx), orderId))).toBe('ALREADY_CONSUMED');
        expect(await inv(ing)).toEqual({ stock: 60, reserved: 0 });
      });

      it('releases on failure once, keeps stock, and never goes back to PENDING', async () => {
        const { ing, orderId } = await pendingOrder(1);
        expect(await prisma.$transaction((tx) => releaseReservation(asTx(tx), orderId, 'PAYMENT_FAILED'))).toBe(true);
        expect(await prisma.$transaction((tx) => releaseReservation(asTx(tx), orderId, 'PAYMENT_FAILED'))).toBe(false);
        expect(await inv(ing)).toEqual({ stock: 100, reserved: 0 });
        expect(await orderState(orderId)).toMatchObject({ status: 'PAYMENT_FAILED', rows: [{ status: 'RELEASED' }] });
      });

      it('does not reclaim stock when SUCCESS arrives after a release', async () => {
        const { ing, orderId } = await pendingOrder(1);
        await prisma.$transaction((tx) => releaseReservation(asTx(tx), orderId, 'PAYMENT_FAILED'));
        await expect(prisma.$transaction((tx) => consumeReservation(asTx(tx), orderId))).rejects.toThrow();
        expect(await inv(ing)).toEqual({ stock: 100, reserved: 0 });
        expect((await orderState(orderId)).status).toBe('PAYMENT_FAILED');
      });

      it('refuses to release an order that is already paid', async () => {
        const { ing, orderId } = await pendingOrder(1);
        await prisma.$transaction((tx) => consumeReservation(asTx(tx), orderId));
        await expect(prisma.$transaction((tx) => releaseReservation(asTx(tx), orderId, 'CANCELLED'))).rejects.toThrow();
        expect(await inv(ing)).toEqual({ stock: 80, reserved: 0 });
        expect((await orderState(orderId)).status).toBe('PAID');
      });

      it('expiry batch cancels and releases once; reruns and a late SUCCESS change nothing', async () => {
        const { ing, orderId } = await pendingOrder(); // reserves 40
        await expireNow(orderId);

        await expiration.expireBatch();
        await expiration.expireBatch();
        expect(await inv(ing)).toEqual({ stock: 100, reserved: 0 });
        expect(await orderState(orderId)).toMatchObject({ status: 'CANCELLED', rows: [{ status: 'RELEASED' }] });

        // Late SUCCESS on the expired order must not take the stock back.
        await expect(prisma.$transaction((tx) => consumeReservation(asTx(tx), orderId))).rejects.toThrow();
        expect(await inv(ing)).toEqual({ stock: 100, reserved: 0 });
      });

      it('a late SUCCESS on an expired PENDING order returns EXPIRED and releases once', async () => {
        const { ing, orderId } = await pendingOrder();
        await expireNow(orderId);
        expect(await prisma.$transaction((tx) => consumeReservation(asTx(tx), orderId))).toBe('EXPIRED');
        expect(await inv(ing)).toEqual({ stock: 100, reserved: 0 });
        expect(await orderState(orderId)).toMatchObject({ status: 'CANCELLED', rows: [{ status: 'RELEASED' }] });
      });

      it('expiry batch racing duplicate callbacks ends in one consistent state', async () => {
        const { ing, orderId } = await pendingOrder();
        await expireNow(orderId);
        await Promise.allSettled([
          expiration.expireBatch(),
          prisma.$transaction((tx) => consumeReservation(asTx(tx), orderId)),
          prisma.$transaction((tx) => consumeReservation(asTx(tx), orderId)),
        ]);
        expect(await inv(ing)).toEqual({ stock: 100, reserved: 0 });
        expect(await orderState(orderId)).toMatchObject({ status: 'CANCELLED', rows: [{ status: 'RELEASED' }] });
      });

      it('rolls back everything when the caller fails after the inventory change', async () => {
        const { ing, orderId } = await pendingOrder(); // reserved 40
        await expect(
          prisma.$transaction(async (tx) => {
            expect(await consumeReservation(asTx(tx), orderId)).toBe('CONSUMED');
            throw new Error('simulated Payment/loyalty failure');
          }),
        ).rejects.toThrow('simulated Payment/loyalty failure');
        expect(await inv(ing)).toEqual({ stock: 100, reserved: 40 });
        expect(await orderState(orderId)).toMatchObject({ status: 'PENDING', rows: [{ status: 'RESERVED' }] });
      });
    });

    // ---------- Step 8: API / permissions / history ----------
    describe('API, permissions and history', () => {
      it('scopes customer orders, lets ADMIN see everything, uses the DB role (not a token claim)', async () => {
        const http = request(app.getHttpServer());
        const a = await createUserAndLogin();
        const b = await createUserAndLogin();
        const admin = await createUserAndLogin('ADMIN');
        const ing = await createIngredient(`Perm-${randomUUID()}`, 'g', 1000);
        const recipe = await createRecipe(`Perm-${randomUUID()}`, 25000, [[ing, 20]]);
        const preferences = { sugarLevel: 50, iceLevel: 'LESS', note: 'Mang di' };
        const created = await post(a.token, { items: [{ ...item(recipe, 1), ...preferences }] }).expect(201);
        const id = created.body.orderId as number;

        const customerDetail = await http.get(`/orders/${id}`).set('Authorization', `Bearer ${a.token}`).expect(200);
        expect(customerDetail.body).toMatchObject({
          recipientName: 'Integration Customer',
          recipientPhone: '0901234567',
          items: [expect.objectContaining(preferences)],
        });
        await http.get(`/orders/${id}`).set('Authorization', `Bearer ${b.token}`).expect(404);
        await http.get(`/orders/${id}`).set('Authorization', `Bearer ${admin.token}`).expect(200);

        await http.get('/admin/orders').expect(401);
        await http.get('/admin/orders').set('Authorization', `Bearer ${a.token}`).expect(403);
        const list = await http.get('/admin/orders?page=1&limit=50').set('Authorization', `Bearer ${admin.token}`).expect(200);
        expect(list.body).toMatchObject({ page: 1, limit: 50 });
        expect(list.body).toEqual(expect.objectContaining({ total: expect.any(Number), totalPages: expect.any(Number) }));
        const found = (list.body.data as Array<{ id: number }>).find((o) => o.id === id);
        expect(found).toMatchObject({
          userEmail: a.email, paymentStatus: null,
          items: [expect.objectContaining({ ...preferences, recipeId: recipe, recipeName: expect.any(String), unitPrice: 25000, subtotal: 25000 })],
        });
        const adminDetail = await http.get(`/admin/orders/${id}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
        expect(adminDetail.body).toMatchObject({
          recipientName: 'Integration Customer',
          recipientPhone: '0901234567',
          items: [expect.objectContaining(preferences)],
        });

        // limit is capped at 50, page must be positive.
        await http.get('/admin/orders?limit=51').set('Authorization', `Bearer ${admin.token}`).expect(400);
        await http.get('/admin/orders?page=0').set('Authorization', `Bearer ${admin.token}`).expect(400);

        // Date and status filters are applied to the result set before pagination.
        const todayInVietnam = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date());
        const filtered = await http.get(`/admin/orders?dateFrom=${todayInVietnam}&dateTo=${todayInVietnam}&status=PENDING&page=1&limit=5`)
          .set('Authorization', `Bearer ${admin.token}`).expect(200);
        expect(filtered.body).toMatchObject({ page: 1, limit: 5 });
        expect(filtered.body.data.every((order: { status: string }) => order.status === 'PENDING')).toBe(true);
        await http.get('/admin/orders?dateFrom=2026-11-30&dateTo=2026-11-01')
          .set('Authorization', `Bearer ${admin.token}`).expect(400);
        await http.get('/admin/orders?status=NOT_A_STATUS')
          .set('Authorization', `Bearer ${admin.token}`).expect(400);

        // Admin can move only the preparation statuses; payment confirmation remains provider-owned.
        await http.patch(`/admin/orders/${id}/status`).set('Authorization', `Bearer ${admin.token}`)
          .send({ status: 'PAID' }).expect(400);
        await http.patch(`/admin/orders/${id}/status`).set('Authorization', `Bearer ${a.token}`)
          .send({ status: 'PREPARING' }).expect(403);

        // Only a verified payment can make an order PAID. Once paid, Admin may
        // advance the three preparation milestones, but cannot skip a step.
        await prisma.$transaction((tx) => consumeReservation(asTx(tx), id));
        await http.patch(`/admin/orders/${id}/status`).set('Authorization', `Bearer ${admin.token}`)
          .send({ status: 'READY' }).expect(400);

        // Two admins racing to start preparation must not overwrite each other.
        const competingUpdates = await Promise.all([
          http.patch(`/admin/orders/${id}/status`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'PREPARING' }),
          http.patch(`/admin/orders/${id}/status`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'PREPARING' }),
        ]);
        // The loser may fail validation before the conditional write (400), or lose the write (409).
        expect(competingUpdates.filter((response) => response.status === 200)).toHaveLength(1);
        expect(competingUpdates.filter((response) => [400, 409].includes(response.status))).toHaveLength(1);
        await http.patch(`/admin/orders/${id}/status`).set('Authorization', `Bearer ${admin.token}`)
          .send({ status: 'COMPLETED' }).expect(400);
        await http.patch(`/admin/orders/${id}/status`).set('Authorization', `Bearer ${admin.token}`)
          .send({ status: 'READY' }).expect(200);
        await http.patch(`/admin/orders/${id}/status`).set('Authorization', `Bearer ${admin.token}`)
          .send({ status: 'COMPLETED' }).expect(200);
        const completed = await http.get(`/orders/${id}`).set('Authorization', `Bearer ${a.token}`).expect(200);
        expect(completed.body.status).toBe('COMPLETED');
        const history = await http.get('/orders/me').set('Authorization', `Bearer ${a.token}`).expect(200);
        expect(history.body).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id, recipientName: 'Integration Customer', recipientPhone: '0901234567',
            items: [expect.objectContaining(preferences)],
          }),
        ]));

        // /auth/me reports the DB role; demoting takes effect with the same token.
        const me = await http.get('/auth/me').set('Authorization', `Bearer ${admin.token}`).expect(200);
        expect(me.body.role).toBe('ADMIN');
        await prisma.$executeRaw`UPDATE "User" SET "role" = 'CUSTOMER' WHERE "id" = ${admin.id}`;
        await http.get('/admin/orders').set('Authorization', `Bearer ${admin.token}`).expect(403);
      });

      it('GET /admin/orders?paymentStatus=... filters by latest payment status before paging', async () => {
        const http = request(app.getHttpServer());
        const user = await createUserAndLogin();
        const admin = await createUserAndLogin('ADMIN');
        const ing = await createIngredient(`PaymentFilter-${randomUUID()}`, 'g', 1000);
        const recipe = await createRecipe(`PaymentFilter-${randomUUID()}`, 25000, [[ing, 20]]);
        const created = await post(user.token, {items:[item(recipe,1)]}).expect(201);
        const orderId = created.body.orderId as number;
        try {
          await prisma.payment.create({data:{orderId,amount:25000,status:'SUCCESS',creationStatus:'READY',createdAt:new Date('2026-01-01T00:00:00Z')}});
          await prisma.payment.create({data:{orderId,amount:25000,status:'FAILED',creationStatus:'REJECTED',createdAt:new Date('2026-01-02T00:00:00Z')}});
          const latest = await http.get('/admin/orders').set('Authorization',`Bearer ${admin.token}`).query({search:user.email,paymentStatus:'FAILED',limit:1}).expect(200);
          expect(latest.body).toMatchObject({total:1,totalPages:1});
          expect(latest.body.data[0]).toMatchObject({id:orderId,paymentStatus:'FAILED'});
          const older = await http.get('/admin/orders').set('Authorization',`Bearer ${admin.token}`).query({search:user.email,paymentStatus:'SUCCESS'}).expect(200);
          expect(older.body.total).toBe(0);
          await http.get('/admin/orders').set('Authorization',`Bearer ${admin.token}`).query({paymentStatus:'PAID'}).expect(400);
        } finally {await prisma.payment.deleteMany({where:{orderId}});}
      });

      it('GET /orders/me stays an array and tolerates legacy productId rows', async () => {
        const http = request(app.getHttpServer());
        const user = await createUserAndLogin();
        const admin = await createUserAndLogin('ADMIN');
        const product = await prisma.$queryRaw<Array<{ id: number }>>`
          INSERT INTO "Product" ("name", "price", "imageUrl", "stock")
          VALUES (${`Legacy-${randomUUID()}`}, 20000, '/legacy.svg', 5) RETURNING "id"
        `;
        const productId = Number(product[0]?.id);
        productIds.push(productId);
        const legacyOrder = await prisma.$queryRaw<Array<{ id: number }>>`
          INSERT INTO "Order" ("userId", "status", "total") VALUES (${user.id}, 'COMPLETED', 20000) RETURNING "id"
        `;
        const legacyId = Number(legacyOrder[0]?.id);
        await prisma.$executeRaw`
          INSERT INTO "OrderItem" ("orderId", "productId", "quantity", "size", "toppings", "unitPrice", "subtotal")
          VALUES (${legacyId}, ${productId}, 1, 'M', '[]'::jsonb, 20000, 20000)
        `;

        const mine = await http.get('/orders/me').set('Authorization', `Bearer ${user.token}`).expect(200);
        expect(Array.isArray(mine.body)).toBe(true);
        expect((mine.body as Array<{ id: number }>).map((o) => o.id)).toContain(legacyId);
        const asAdmin = await http.get(`/admin/orders/${legacyId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
        expect(asAdmin.body.items[0]).toMatchObject({ productId, recipeId: null, recipeName: expect.stringContaining('Legacy-') });
      });

      it('exposes no API that forces an order to PAID', async () => {
        const http = request(app.getHttpServer());
        const user = await createUserAndLogin();
        for (const path of ['/orders/1/status', '/orders/1/pay', '/admin/orders/1/status']) {
          const res = await http.patch(path).set('Authorization', `Bearer ${user.token}`).send({ status: 'PAID' });
          expect([401, 403, 404]).toContain(res.status);
        }
      });
    });
  },
);
