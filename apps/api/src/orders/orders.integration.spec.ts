import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { JwtService } from '@nestjs/jwt';
import {
  consumeReservation,
  releaseReservation,
  type OrdersInventoryTransaction,
} from './orders.inventory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../generated/prisma/client.js';
import request from 'supertest';

const integrationEnabled = process.env.RUN_DB_INTEGRATION === '1';

describe.skipIf(!integrationEnabled)(
  'Phat: recipe ingredient inventory + Orders API integration',
  () => {
    let app!: INestApplication;
    let prisma!: PrismaClient;
    let jwt!: JwtService;
    const userIds: number[] = [];
    const recipeIds: number[] = [];
    const ingredientIds: number[] = [];

    beforeAll(async () => {
      if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
        throw new Error(
          'Set DATABASE_URL and JWT_SECRET in apps/api/.env before integration testing',
        );
      }

      const { AppModule } = await import('../app.module.js');
      const testingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = testingModule.createNestApplication();
      await app.init();

      prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      });
      jwt = new JwtService({ secret: process.env.JWT_SECRET });
    });

    afterAll(async () => {
      if (prisma) {
        for (const userId of userIds) {
          await prisma.$executeRaw`
            DELETE FROM "OrderIngredient"
            WHERE "orderId" IN (SELECT "id" FROM "Order" WHERE "userId" = ${userId})
          `;
          await prisma.order.deleteMany({ where: { userId } });
        }
        for (const recipeId of recipeIds) {
          await prisma.$executeRaw`
            DELETE FROM "RecipeIngredient" WHERE "recipeId" = ${recipeId}
          `;
          await prisma.$executeRaw`
            DELETE FROM "Recipe" WHERE "id" = ${recipeId}
          `;
        }
        for (const ingredientId of ingredientIds) {
          await prisma.$executeRaw`
            DELETE FROM "Ingredient" WHERE "id" = ${ingredientId}
          `;
        }
        for (const userId of userIds) {
          await prisma.user.deleteMany({ where: { id: userId } });
        }
        await prisma.$disconnect();
      }
      if (app) await app.close();
    });

    async function createUserAndLogin() {
      const http = request(app.getHttpServer());
      const email = `orders-integration-${randomUUID()}@example.test`;
      const password = 'IntegrationTest123!';
      const registered = await http
        .post('/auth/register')
        .send({ email, password })
        .expect(201);
      userIds.push(registered.body.id as number);
      const login = await http
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      return {
        id: registered.body.id as number,
        token: login.body.accessToken as string,
      };
    }

    async function createIngredient(name: string, unit: 'g' | 'ml', stock: number) {
      const rows = await prisma.$queryRaw<Array<{ id: number }>>`
        INSERT INTO "Ingredient" (
          "name", "unit", "stock", "reserved", "minStock", "version"
        )
        VALUES (${name}, ${unit}, ${stock}, 0, 0, 0)
        RETURNING "id"
      `;
      const id = Number(rows[0]?.id);
      if (!id) throw new Error(`Could not create test ingredient: ${name}`);
      ingredientIds.push(id);
      return id;
    }

    async function createRecipe(name: string, price: number, ingredientId: number, quantity: number) {
      const rows = await prisma.$queryRaw<Array<{ id: number }>>`
        INSERT INTO "Recipe" ("name", "price", "imageUrl", "isActive")
        VALUES (${name}, ${price}, '/integration-test.svg', TRUE)
        RETURNING "id"
      `;
      const id = Number(rows[0]?.id);
      if (!id) throw new Error(`Could not create test recipe: ${name}`);
      recipeIds.push(id);
      await prisma.$executeRaw`
        INSERT INTO "RecipeIngredient" ("recipeId", "ingredientId", "quantity")
        VALUES (${id}, ${ingredientId}, ${quantity})
      `;
      return id;
    }

    it('reserves recipe ingredients, replays idempotency, and enforces order ownership/admin access', async () => {
      const http = request(app.getHttpServer());
      const userA = await createUserAndLogin();
      const userB = await createUserAndLogin();
      const coffeeId = await createIngredient(`Coffee-${randomUUID()}`, 'g', 1000);
      const recipeId = await createRecipe(`Recipe-${randomUUID()}`, 25000, coffeeId, 20);
      const payload = {
        items: [{ productId: recipeId, quantity: 2, size: 'M', toppings: [] }],
      };
      const key = `orders-${randomUUID()}`;

      const created = await http
        .post('/orders')
        .set('Authorization', `Bearer ${userA.token}`)
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(201);
      expect(created.body).toMatchObject({ status: 'PENDING', total: 50000 });

      const inventoryAfterCreate = await prisma.$queryRaw<Array<{ stock: number; reserved: number }>>`
        SELECT "stock", "reserved" FROM "Ingredient" WHERE "id" = ${coffeeId}
      `;
      expect(Number(inventoryAfterCreate[0]?.stock)).toBe(1000);
      expect(Number(inventoryAfterCreate[0]?.reserved)).toBe(40);

      const savedItems = await prisma.$queryRaw<Array<{
        productId: number | null;
        recipeId: number | null;
        recipeName: string | null;
      }>>`
        SELECT "productId", "recipeId", "recipeName"
        FROM "OrderItem" WHERE "orderId" = ${created.body.orderId}
      `;
      expect(savedItems).toEqual([{
        productId: null,
        recipeId,
        recipeName: expect.stringContaining('Recipe-'),
      }]);

      const reservation = await prisma.$queryRaw<Array<{ quantity: number; status: string }>>`
        SELECT "quantity", "status" FROM "OrderIngredient"
        WHERE "orderId" = ${created.body.orderId}
      `;
      expect(reservation).toHaveLength(1);
      expect(Number(reservation[0]?.quantity)).toBe(40);
      expect(reservation[0]?.status).toBe('RESERVED');

      const replay = await http
        .post('/orders')
        .set('Authorization', `Bearer ${userA.token}`)
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(201);
      expect(replay.body.orderId).toBe(created.body.orderId);
      const inventoryAfterReplay = await prisma.$queryRaw<Array<{ reserved: number }>>`
        SELECT "reserved" FROM "Ingredient" WHERE "id" = ${coffeeId}
      `;
      expect(Number(inventoryAfterReplay[0]?.reserved)).toBe(40);
      await http
        .post('/orders')
        .set('Authorization', `Bearer ${userA.token}`)
        .set('Idempotency-Key', key)
        .send({ items: [{ productId: recipeId, quantity: 1 }] })
        .expect(409);

      await http
        .get(`/orders/${created.body.orderId}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);
      await http
        .get(`/orders/${created.body.orderId}`)
        .set('Authorization', `Bearer ${userB.token}`)
        .expect(404);
      await http
        .get('/admin/orders')
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(403);

      const adminToken = await jwt.signAsync({ sub: userA.id, role: 'ADMIN' });
      const adminList = await http
        .get('/admin/orders?page=1&limit=20')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(adminList.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: created.body.orderId,
            userEmail: expect.stringContaining('orders-integration-'),
            paymentStatus: null,
          }),
        ]),
      );
      await http
        .get(`/admin/orders/${created.body.orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const historyA = await http
        .get('/orders/me')
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);
      expect(historyA.body.map((order: { id: number }) => order.id)).toContain(
        created.body.orderId,
      );
      const historyB = await http
        .get('/orders/me')
        .set('Authorization', `Bearer ${userB.token}`)
        .expect(200);
      expect(historyB.body.map((order: { id: number }) => order.id)).not.toContain(
        created.body.orderId,
      );
    });

    it('allows at most one concurrent order when only one reservation fits', async () => {
      const http = request(app.getHttpServer());
      const userA = await createUserAndLogin();
      const userB = await createUserAndLogin();
      const ingredientId = await createIngredient(`Limited-${randomUUID()}`, 'g', 50);
      const recipeId = await createRecipe(`LimitedRecipe-${randomUUID()}`, 25000, ingredientId, 20);
      const body = {
        items: [{ productId: recipeId, quantity: 2, size: 'M', toppings: [] }],
      };

      const responses = await Promise.all([
        http.post('/orders')
          .set('Authorization', `Bearer ${userA.token}`)
          .set('Idempotency-Key', `race-a-${randomUUID()}`)
          .send(body),
        http.post('/orders')
          .set('Authorization', `Bearer ${userB.token}`)
          .set('Idempotency-Key', `race-b-${randomUUID()}`)
          .send(body),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([201, 400]);

      const stock = await prisma.$queryRaw<Array<{ stock: number; reserved: number }>>`
        SELECT "stock", "reserved" FROM "Ingredient" WHERE "id" = ${ingredientId}
      `;
      expect(Number(stock[0]?.stock)).toBe(50);
      expect(Number(stock[0]?.reserved)).toBe(40);
    });

    it('consumes a reservation only once for successful payment handling', async () => {
      const http = request(app.getHttpServer());
      const user = await createUserAndLogin();
      const ingredientId = await createIngredient(`Consume-${randomUUID()}`, 'g', 100);
      const recipeId = await createRecipe(`ConsumeRecipe-${randomUUID()}`, 25000, ingredientId, 20);
      const created = await http
        .post('/orders')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ items: [{ productId: recipeId, quantity: 2, size: 'M', toppings: [] }] })
        .expect(201);

      const first = await prisma.$transaction((tx) =>
        consumeReservation(tx as unknown as OrdersInventoryTransaction, created.body.orderId),
      );
      const duplicate = await prisma.$transaction((tx) =>
        consumeReservation(tx as unknown as OrdersInventoryTransaction, created.body.orderId),
      );
      expect(first).toBe('CONSUMED');
      expect(duplicate).toBe('ALREADY_CONSUMED');

      const inventory = await prisma.$queryRaw<Array<{ stock: number; reserved: number }>>`
        SELECT "stock", "reserved" FROM "Ingredient" WHERE "id" = ${ingredientId}
      `;
      expect(Number(inventory[0]?.stock)).toBe(60);
      expect(Number(inventory[0]?.reserved)).toBe(0);
      const order = await prisma.$queryRaw<Array<{ status: string; reservationStatus: string }>>`
        SELECT o."status", oi."status" AS "reservationStatus"
        FROM "Order" o
        JOIN "OrderIngredient" oi ON oi."orderId" = o."id"
        WHERE o."id" = ${created.body.orderId}
      `;
      expect(order[0]).toMatchObject({ status: 'PAID', reservationStatus: 'CONSUMED' });
    });

    it('releases a reservation once on failure and does not decrement stock', async () => {
      const http = request(app.getHttpServer());
      const user = await createUserAndLogin();
      const ingredientId = await createIngredient(`Release-${randomUUID()}`, 'g', 100);
      const recipeId = await createRecipe(`ReleaseRecipe-${randomUUID()}`, 25000, ingredientId, 20);
      const created = await http
        .post('/orders')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ items: [{ productId: recipeId, quantity: 1, size: 'M', toppings: [] }] })
        .expect(201);

      const first = await prisma.$transaction((tx) =>
        releaseReservation(tx as unknown as OrdersInventoryTransaction, created.body.orderId, 'PAYMENT_FAILED'),
      );
      const duplicate = await prisma.$transaction((tx) =>
        releaseReservation(tx as unknown as OrdersInventoryTransaction, created.body.orderId, 'PAYMENT_FAILED'),
      );
      expect(first).toBe(true);
      expect(duplicate).toBe(false);

      const inventory = await prisma.$queryRaw<Array<{ stock: number; reserved: number }>>`
        SELECT "stock", "reserved" FROM "Ingredient" WHERE "id" = ${ingredientId}
      `;
      expect(Number(inventory[0]?.stock)).toBe(100);
      expect(Number(inventory[0]?.reserved)).toBe(0);
    });

    it('rejects a late successful callback after expiry and releases the held ingredients', async () => {
      const http = request(app.getHttpServer());
      const user = await createUserAndLogin();
      const ingredientId = await createIngredient(`Expired-${randomUUID()}`, 'g', 100);
      const recipeId = await createRecipe(`ExpiredRecipe-${randomUUID()}`, 25000, ingredientId, 20);
      const created = await http
        .post('/orders')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ items: [{ productId: recipeId, quantity: 1, size: 'M', toppings: [] }] })
        .expect(201);
      await prisma.$executeRaw`
        UPDATE "Order"
        SET "expiresAt" = CURRENT_TIMESTAMP - INTERVAL '1 second'
        WHERE "id" = ${created.body.orderId}
      `;

      const result = await prisma.$transaction((tx) =>
        consumeReservation(tx as unknown as OrdersInventoryTransaction, created.body.orderId),
      );
      expect(result).toBe('EXPIRED');
      const inventory = await prisma.$queryRaw<Array<{ stock: number; reserved: number }>>`
        SELECT "stock", "reserved" FROM "Ingredient" WHERE "id" = ${ingredientId}
      `;
      expect(Number(inventory[0]?.stock)).toBe(100);
      expect(Number(inventory[0]?.reserved)).toBe(0);
      const order = await prisma.$queryRaw<Array<{ status: string; reservationStatus: string }>>`
        SELECT o."status", oi."status" AS "reservationStatus"
        FROM "Order" o
        JOIN "OrderIngredient" oi ON oi."orderId" = o."id"
        WHERE o."id" = ${created.body.orderId}
      `;
      expect(order[0]).toMatchObject({ status: 'CANCELLED', reservationStatus: 'RELEASED' });
    });

  },
);
