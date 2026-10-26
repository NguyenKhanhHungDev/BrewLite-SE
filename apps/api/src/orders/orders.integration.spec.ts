import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../generated/prisma/client.js';
import request from 'supertest';

const integrationEnabled = process.env.RUN_DB_INTEGRATION === '1';

describe.skipIf(!integrationEnabled)(
  'A1-06/A1-09 real PostgreSQL + JWT integration',
  () => {
    let app!: INestApplication;
    let prisma!: PrismaClient;
    const userIds: number[] = [];
    let productId: number | undefined;

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
    });

    afterAll(async () => {
      if (prisma) {
        if (userIds.length > 0) {
          await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
          await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
        if (productId !== undefined) {
          await prisma.product.deleteMany({ where: { id: productId } });
        }
        await prisma.$disconnect();
      }
      if (app) await app.close();
    });

    it('persists orders, protects history by JWT user, and safely replays idempotency key', async () => {
      const http = request(app.getHttpServer());
      const password = 'IntegrationTest123!';

      async function createUserAndLogin() {
        const email = `orders-integration-${randomUUID()}@example.test`;
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

      const userA = await createUserAndLogin();
      const userB = await createUserAndLogin();
      expect(userA.token).toBeTruthy();
      expect(userB.token).toBeTruthy();

      const product = await prisma.product.create({
        data: {
          name: `Orders integration ${randomUUID()}`,
          price: 25000,
          imageUrl: '/integration-test.svg',
          stock: 10,
        },
      });
      productId = product.id;

      const firstPayload = {
        items: [
          { productId: product.id, quantity: 2, size: 'M', toppings: [] },
        ],
      };
      const idempotencyKey = `integration-${randomUUID()}`;
      const created = await http
        .post('/orders')
        .set('Authorization', `Bearer ${userA.token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(firstPayload)
        .expect(201);

      expect(created.body).toMatchObject({ status: 'PENDING', total: 50000 });
      expect(Number.isSafeInteger(created.body.orderId)).toBe(true);

      const persisted = await prisma.order.findUnique({
        where: { id: created.body.orderId as number },
        include: { items: true },
      });
      expect(persisted).not.toBeNull();
      expect(persisted?.userId).toBe(userA.id);
      expect(persisted?.status).toBe('PENDING');
      expect(persisted?.total).toBe(50000);
      expect(persisted?.items).toHaveLength(1);
      expect(persisted?.items[0]).toMatchObject({
        productId: product.id,
        quantity: 2,
        unitPrice: 25000,
        subtotal: 50000,
      });

      const replay = await http
        .post('/orders')
        .set('Authorization', `Bearer ${userA.token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(firstPayload)
        .expect(201);
      expect(replay.body.orderId).toBe(created.body.orderId);

      const secondAOrder = await http
        .post('/orders')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ items: [{ productId: product.id, quantity: 1 }] })
        .expect(201);
      const orderB = await http
        .post('/orders')
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ items: [{ productId: product.id, quantity: 1 }] })
        .expect(201);

      expect(await prisma.order.count({ where: { userId: userA.id } })).toBe(2);
      expect(await prisma.order.count({ where: { userId: userB.id } })).toBe(1);

      const historyA = await http
        .get('/orders/me')
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);
      expect(historyA.body).toHaveLength(2);
      expect(historyA.body[0].id).toBe(secondAOrder.body.orderId);
      expect(
        historyA.body.map((order: { id: number }) => order.id),
      ).not.toContain(orderB.body.orderId);
      expect(historyA.body[0].items[0]).toMatchObject({
        productId: product.id,
        quantity: 1,
      });
      expect(historyA.body[0]).not.toHaveProperty('userId');

      const historyB = await http
        .get('/orders/me')
        .set('Authorization', `Bearer ${userB.token}`)
        .expect(200);
      expect(historyB.body).toHaveLength(1);
      expect(historyB.body[0].id).toBe(orderB.body.orderId);
      expect(
        historyB.body.map((order: { id: number }) => order.id),
      ).not.toContain(created.body.orderId);

      await http
      .post('/orders')
      .set('Authorization', `Bearer ${userA.token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ items: [{ productId: product.id, quantity: 3 }] })
      .expect(409);

      const discounted = await http
        .post('/orders')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          items: [{ productId: product.id, quantity: 2 }],
          promoCode: 'BREW10',
        })
        .expect(201);
      expect(discounted.body.total).toBe(45000);

      const savedDiscount = await prisma.order.findUniqueOrThrow({
        where: { id: discounted.body.orderId as number },
      });
      expect(savedDiscount.total).toBe(45000);
      expect(savedDiscount.discount).toBe(5000);
      expect(savedDiscount.promoCode).toBe('BREW10');

      await http
      .post('/orders')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        items: [{ productId: product.id, quantity: 1 }],
        promoCode: 'INVALID',
      })
      .expect(400);

      await http.get('/orders/me').expect(401);
      await http.post('/orders').send(firstPayload).expect(401);
      await http
      .post('/orders')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ items: [], total: 1 })
      .expect(400);
    });
  },
);
