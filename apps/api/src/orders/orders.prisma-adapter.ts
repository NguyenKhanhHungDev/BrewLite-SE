import 'dotenv/config';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type {
  AdminOrderPage,
  AdminOrderRecord,
  IngredientSnapshot,
  OrderDetailRecord,
  OrderDraft,
  OrdersStore,
  RecipeSnapshot,
  StoredOrderResult,
  ToppingIngredientSnapshot,
} from './orders.contract.js';
import { calculateIngredientNeeds } from './orders.ingredients.js';
import {
  releaseReservation,
  reserveForOrder,
  type OrdersInventoryTransaction,
} from './orders.inventory.js';

const PEARL_NAME = 'Trân châu';
const CREAM_NAME = 'Kem sữa';

interface RecipeRow {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
  ingredientId: number | null;
  quantity: number | null;
  ingredientName: string | null;
  unit: string | null;
  stock: number | null;
  reserved: number | null;
  version: number | null;
}

interface IngredientRow {
  id: number;
  name: string;
  unit: string;
  stock: number;
  reserved: number;
  version: number;
}

interface OrderRow {
  id: number;
  status: string;
  total: number;
  createdAt: Date;
  expiresAt: Date | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  userEmail?: string;
  paymentStatus?: string | null;
}

interface OrderItemRow {
  recipeId: number | null;
  recipeName: string | null;
  productId: number | null;
  productName: string | null;
  quantity: number;
  size: string;
  toppings: unknown;
  unitPrice: number;
  subtotal: number;
}

function ingredientFromRow(row: IngredientRow): IngredientSnapshot {
  return {
    id: Number(row.id),
    name: row.name,
    unit: row.unit,
    stock: Number(row.stock),
    reserved: Number(row.reserved),
    version: Number(row.version),
  };
}

function mapRecipeRows(rows: RecipeRow[]): RecipeSnapshot | null {
  if (rows.length === 0) return null;
  const first = rows[0]!;
  const ingredients = rows
    .filter((row) => row.ingredientId !== null)
    .map((row) => {
      if (
        row.quantity === null ||
        row.ingredientName === null ||
        row.unit === null ||
        row.stock === null ||
        row.reserved === null ||
        row.version === null
      ) {
        throw new BadRequestException(
          `Công thức ${first.id} tham chiếu nguyên liệu không hợp lệ`,
        );
      }
      return {
        ingredientId: Number(row.ingredientId),
        quantity: Number(row.quantity),
        ingredient: {
          id: Number(row.ingredientId),
          name: row.ingredientName,
          unit: row.unit,
          stock: Number(row.stock),
          reserved: Number(row.reserved),
          version: Number(row.version),
        },
      };
    });
  return {
    id: Number(first.id),
    name: first.name,
    price: Number(first.price),
    isActive: first.isActive,
    ingredients,
  };
}

function mapToppings(rows: IngredientRow[]): ToppingIngredientSnapshot {
  const pearl = rows.find(
    (row) =>
      row.name.toLocaleLowerCase('vi') === PEARL_NAME.toLocaleLowerCase('vi'),
  );
  const cream = rows.find(
    (row) =>
      row.name.toLocaleLowerCase('vi') === CREAM_NAME.toLocaleLowerCase('vi'),
  );
  return {
    pearl: pearl ? ingredientFromRow(pearl) : null,
    cream: cream ? ingredientFromRow(cream) : null,
  };
}

function mapItems(rows: OrderItemRow[]) {
  return rows.map((row) => ({
    recipeId: row.recipeId === null ? null : Number(row.recipeId),
    recipeName: row.recipeName ?? row.productName ?? 'Món đã ngừng kinh doanh',
    // Keep the legacy API field usable by the menu UI: new productId values alias Recipe.id.
    productId:
      row.productId === null
        ? row.recipeId === null
          ? null
          : Number(row.recipeId)
        : Number(row.productId),
    quantity: Number(row.quantity),
    size: row.size,
    toppings: Array.isArray(row.toppings)
      ? row.toppings.filter(
          (value): value is string => typeof value === 'string',
        )
      : [],
    unitPrice: Number(row.unitPrice),
    subtotal: Number(row.subtotal),
  }));
}

@Injectable()
export class OrdersPrismaAdapter implements OrdersStore, OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is missing');
    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  }

  async getRecipeById(id: number): Promise<RecipeSnapshot | null> {
    const rows = await this.prisma.$queryRaw<RecipeRow[]>`
      SELECT
        r."id", r."name", r."price", r."isActive",
        ri."ingredientId", ri."quantity",
        i."name" AS "ingredientName", i."unit", i."stock", i."reserved", i."version"
      FROM "Recipe" r
      LEFT JOIN "RecipeIngredient" ri ON ri."recipeId" = r."id"
      LEFT JOIN "Ingredient" i ON i."id" = ri."ingredientId"
      WHERE r."id" = ${id}
      ORDER BY ri."ingredientId" ASC
    `;
    return mapRecipeRows(rows);
  }

  async getToppingIngredients(): Promise<ToppingIngredientSnapshot> {
    const rows = await this.prisma.$queryRaw<IngredientRow[]>`
      SELECT "id", "name", "unit", "stock", "reserved", "version"
      FROM "Ingredient"
      WHERE LOWER("name") = LOWER(${PEARL_NAME})
         OR LOWER("name") = LOWER(${CREAM_NAME})
      ORDER BY "id" ASC
    `;
    return mapToppings(rows);
  }

  async findOrderByIdempotencyKey(
    userId: number,
    key: string,
  ): Promise<StoredOrderResult | null> {
    const rows = await this.prisma.$queryRaw<StoredOrderResult[]>`
      SELECT "id", "status", "total", "idempotencyHash", "recipientName", "recipientPhone"
      FROM "Order"
      WHERE "userId" = ${userId} AND "idempotencyKey" = ${key}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async updateLegacyRecipientSnapshot(
    userId: number,
    key: string,
    legacyHash: string,
    currentHash: string,
    recipientName: string,
    recipientPhone: string,
  ): Promise<boolean> {
    const updated = await this.prisma.$queryRaw<Array<{ id: number }>>`
      UPDATE "Order"
      SET "recipientName" = ${recipientName},
          "recipientPhone" = ${recipientPhone},
          "idempotencyHash" = ${currentHash}
      WHERE "userId" = ${userId}
        AND "idempotencyKey" = ${key}
        AND "idempotencyHash" = ${legacyHash}
        AND "recipientName" IS NULL
        AND "recipientPhone" IS NULL
      RETURNING "id"
    `;
    return updated.length === 1;
  }

  async saveOrder(draft: OrderDraft): Promise<StoredOrderResult> {
    return this.prisma.$transaction(async (tx) => {
      if (draft.idempotencyKey) {
        // pg_advisory_xact_lock returns void, which the pg driver adapter cannot
        // deserialize; cast to text so the lock is taken without a 500.
        await tx.$queryRaw<Array<{ locked: string }>>`
          SELECT pg_advisory_xact_lock(${draft.userId}, hashtext(${draft.idempotencyKey}))::text AS "locked"
        `;
        const existing = await tx.$queryRaw<StoredOrderResult[]>`
          SELECT "id", "status", "total", "idempotencyHash", "recipientName", "recipientPhone"
          FROM "Order"
          WHERE "userId" = ${draft.userId}
            AND "idempotencyKey" = ${draft.idempotencyKey}
          LIMIT 1
          FOR UPDATE
        `;
        if (existing[0]) {
          if (existing[0].idempotencyHash !== draft.idempotencyHash) {
            throw new ConflictException(
              'Idempotency-Key đã được sử dụng với nội dung khác',
            );
          }
          return existing[0];
        }
      }

      const recipeIds = [
        ...new Set(draft.items.map((line) => line.productId)),
      ].sort((a, b) => a - b);
      const recipeRows = await tx.$queryRaw<RecipeRow[]>`
        SELECT
          r."id", r."name", r."price", r."isActive",
          ri."ingredientId", ri."quantity",
          i."name" AS "ingredientName", i."unit", i."stock", i."reserved", i."version"
        FROM "Recipe" r
        LEFT JOIN "RecipeIngredient" ri ON ri."recipeId" = r."id"
        LEFT JOIN "Ingredient" i ON i."id" = ri."ingredientId"
        WHERE r."id" = ANY(${recipeIds}::int[])
        ORDER BY r."id" ASC, ri."ingredientId" ASC
      `;

      const recipes = new Map<number, RecipeSnapshot>();
      const rowsByRecipe = new Map<number, RecipeRow[]>();
      for (const row of recipeRows) {
        const group = rowsByRecipe.get(Number(row.id)) ?? [];
        group.push(row);
        rowsByRecipe.set(Number(row.id), group);
      }
      for (const [id, rows] of rowsByRecipe) {
        const recipe = mapRecipeRows(rows);
        if (recipe) recipes.set(id, recipe);
      }
      for (const line of draft.items) {
        const recipe = recipes.get(line.productId);
        if (!recipe)
          throw new NotFoundException(`Không tìm thấy món ${line.productId}`);
        if (!recipe.isActive || recipe.ingredients.length === 0) {
          throw new BadRequestException(
            `Món ${recipe.name} không có công thức đang hoạt động`,
          );
        }
        if (
          recipe.name !== line.recipeName ||
          recipe.price !== line.basePrice
        ) {
          throw new ConflictException({
            code: 'ORDER_CATALOG_CHANGED',
            message:
              'Công thức hoặc giá món vừa thay đổi; vui lòng tải lại giỏ hàng',
          });
        }
      }

      const toppingRows = await tx.$queryRaw<IngredientRow[]>`
        SELECT "id", "name", "unit", "stock", "reserved", "version"
        FROM "Ingredient"
        WHERE LOWER("name") = LOWER(${PEARL_NAME})
           OR LOWER("name") = LOWER(${CREAM_NAME})
        ORDER BY "id" ASC
      `;
      const toppingIngredients = mapToppings(toppingRows);
      const requirements = calculateIngredientNeeds(
        draft.items.map((line) => ({
          recipe: recipes.get(line.productId)!,
          quantity: line.quantity,
          size: line.size,
          toppings: line.toppings,
        })),
        toppingIngredients,
      );

      const orderRows = await tx.$queryRaw<StoredOrderResult[]>`
        INSERT INTO "Order" (
          "userId", "status", "total", "discount", "promoCode",
          "recipientName", "recipientPhone",
          "idempotencyKey", "idempotencyHash", "expiresAt"
        )
        VALUES (
          ${draft.userId}, ${draft.status}, ${draft.total}, ${draft.discount},
          ${draft.promoCode}, ${draft.recipientName}, ${draft.recipientPhone},
          ${draft.idempotencyKey}, ${draft.idempotencyHash},
          CURRENT_TIMESTAMP + INTERVAL '15 minutes'
        )
        RETURNING "id", "status", "total", "idempotencyHash"
      `;
      const order = orderRows[0];
      if (!order) throw new ConflictException('Không thể tạo đơn hàng');

      for (const line of draft.items) {
        await tx.$executeRaw`
          INSERT INTO "OrderItem" (
            "orderId", "productId", "recipeId", "recipeName",
            "quantity", "size", "toppings", "unitPrice", "subtotal"
          )
          VALUES (
            ${order.id}, NULL, ${line.productId}, ${line.recipeName},
            ${line.quantity}, ${line.size}, ${JSON.stringify(line.toppings)}::jsonb,
            ${line.unitPrice}, ${line.subtotal}
          )
        `;
      }

      await reserveForOrder(
        tx as unknown as OrdersInventoryTransaction,
        order.id,
        requirements,
      );
      return order;
    });
  }

  async findOrderForUser(
    orderId: number,
    userId: number,
  ): Promise<OrderDetailRecord | null> {
    const orders = await this.prisma.$queryRaw<OrderRow[]>`
      SELECT
        "id", "status", "total", "createdAt", "expiresAt",
        "recipientName", "recipientPhone"
      FROM "Order"
      WHERE "id" = ${orderId} AND "userId" = ${userId}
      LIMIT 1
    `;
    const order = orders[0];
    if (!order) return null;
    const items = await this.getOrderItems(orderId);
    return {
      id: Number(order.id),
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt,
      expiresAt: order.expiresAt,
      recipientName: order.recipientName ?? null,
      recipientPhone: order.recipientPhone ?? null,
      items,
    };
  }

  async findAdminOrder(orderId: number): Promise<AdminOrderRecord | null> {
    const orders = await this.prisma.$queryRaw<OrderRow[]>`
      SELECT
        o."id", o."status", o."total", o."createdAt", o."expiresAt",
        o."recipientName", o."recipientPhone",
        u."email" AS "userEmail",
        (SELECT p."status" FROM "Payment" p WHERE p."orderId" = o."id" ORDER BY p."createdAt" DESC, p."id" DESC LIMIT 1) AS "paymentStatus"
      FROM "Order" o
      JOIN "User" u ON u."id" = o."userId"
      WHERE o."id" = ${orderId}
      LIMIT 1
    `;
    const order = orders[0];
    if (!order) return null;
    return {
      id: Number(order.id),
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt,
      expiresAt: order.expiresAt,
      recipientName: order.recipientName ?? null,
      recipientPhone: order.recipientPhone ?? null,
      userEmail: order.userEmail ?? '',
      paymentStatus: order.paymentStatus ?? null,
      items: await this.getOrderItems(orderId),
    };
  }

  async listAdminOrders(
    page: number,
    limit: number,
    filters: { dateFrom: Date | null; dateToExclusive: Date | null; status: string | null },
  ): Promise<AdminOrderPage> {
    const offset = (page - 1) * limit;
    const { dateFrom, dateToExclusive, status } = filters;
    const [countRows, orders] = await Promise.all([
      this.prisma.$queryRaw<Array<{ total: bigint | number }>>`
        SELECT COUNT(*) AS "total"
        FROM "Order" o
        WHERE (${dateFrom}::timestamptz IS NULL OR o."createdAt" >= ${dateFrom})
          AND (${dateToExclusive}::timestamptz IS NULL OR o."createdAt" < ${dateToExclusive})
          AND (${status}::text IS NULL OR o."status" = ${status})
      `,
      this.prisma.$queryRaw<Array<OrderRow & { items: OrderItemRow[] }>>`
        SELECT
          o."id", o."status", o."total", o."createdAt", o."expiresAt",
          o."recipientName", o."recipientPhone",
          u."email" AS "userEmail",
          (SELECT p."status" FROM "Payment" p WHERE p."orderId" = o."id" ORDER BY p."createdAt" DESC, p."id" DESC LIMIT 1) AS "paymentStatus",
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'recipeId', oi."recipeId",
              'recipeName', COALESCE(oi."recipeName", product."name"),
              'productId', oi."productId",
              'quantity', oi."quantity",
              'size', oi."size",
              'toppings', oi."toppings",
              'unitPrice', oi."unitPrice",
              'subtotal', oi."subtotal"
            ) ORDER BY oi."id")
            FROM "OrderItem" oi
            LEFT JOIN "Product" product ON product."id" = oi."productId"
            WHERE oi."orderId" = o."id"
          ), '[]'::jsonb) AS "items"
        FROM "Order" o
        JOIN "User" u ON u."id" = o."userId"
        WHERE (${dateFrom}::timestamptz IS NULL OR o."createdAt" >= ${dateFrom})
          AND (${dateToExclusive}::timestamptz IS NULL OR o."createdAt" < ${dateToExclusive})
          AND (${status}::text IS NULL OR o."status" = ${status})
        ORDER BY o."createdAt" DESC, o."id" DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    const data = orders.map((order) => ({
      id: Number(order.id),
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt,
      expiresAt: order.expiresAt,
      recipientName: order.recipientName ?? null,
      recipientPhone: order.recipientPhone ?? null,
      userEmail: order.userEmail ?? '',
      paymentStatus: order.paymentStatus ?? null,
      items: mapItems(order.items ?? []),
    }));

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async expirePendingOrders(batchSize: number): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id"
        FROM "Order"
        WHERE "status" = 'PENDING'
          AND NOT EXISTS (
            SELECT 1 FROM "Payment" p
            WHERE p."orderId" = "Order"."id" AND p."provider" = 'ZALOPAY'
              AND p."status" = 'PENDING' AND p."creationStatus" <> 'REJECTED'
          )
          AND "expiresAt" IS NOT NULL
          AND "expiresAt" <= CURRENT_TIMESTAMP
        ORDER BY "expiresAt" ASC, "id" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `;
      let count = 0;
      for (const order of expired) {
        await releaseReservation(
          tx as unknown as OrdersInventoryTransaction,
          Number(order.id),
          'CANCELLED',
        );
        count += 1;
      }
      return count;
    });
  }

  private async getOrderItems(orderId: number) {
    const rows = await this.prisma.$queryRaw<OrderItemRow[]>`
      SELECT
        oi."recipeId", oi."recipeName", oi."productId", product."name" AS "productName",
        oi."quantity", oi."size", oi."toppings", oi."unitPrice", oi."subtotal"
      FROM "OrderItem" oi
      LEFT JOIN "Product" product ON product."id" = oi."productId"
      WHERE oi."orderId" = ${orderId}
      ORDER BY oi."id" ASC
    `;
    return mapItems(rows);
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
