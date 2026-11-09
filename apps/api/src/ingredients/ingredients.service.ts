import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  Prisma,
  type Ingredient,
} from '../generated/prisma/client.js';
import type { AdjustIngredientDto } from './dto/adjust-ingredient.dto.js';
import type { CreateIngredientDto } from './dto/create-ingredient.dto.js';
import type { UpdateIngredientDto } from './dto/update-ingredient.dto.js';

// These names are the stable lookup keys used by the order topping resolver.
function isToppingName(name: string) {
  return ['trân châu', 'kem sữa'].includes(name.trim().toLocaleLowerCase('vi'));
}

function response({
  id,
  name,
  unit,
  stock,
  reserved,
  minStock,
  version,
}: Ingredient) {
  return {
    id,
    name,
    unit,
    stock,
    reserved,
    available: stock - reserved,
    minStock,
    version,
  };
}

@Injectable()
export class IngredientsService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is missing');
    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  }

  async findAll() {
    return (
      await this.prisma.ingredient.findMany({ orderBy: { id: 'asc' } })
    ).map(response);
  }

  async create(input: CreateIngredientDto) {
    if (isToppingName(input.name)) {
      throw new ConflictException('Tên nguyên liệu dành riêng cho topping.');
    }
    try {
      return response(
        await this.prisma.ingredient.create({
          data: {
            name: input.name.trim(),
            unit: input.unit,
            stock: input.stock,
            minStock: input.minStock,
            reserved: 0,
          },
        }),
      );
    } catch (error) {
      this.rethrow(error);
    }
  }

  async update(id: number, input: UpdateIngredientDto) {
    if (input.name === undefined && input.minStock === undefined)
      throw new BadRequestException('Chọn tên hoặc ngưỡng tồn cần sửa.');
    if (input.name !== undefined) {
      const current = await this.prisma.ingredient.findUnique({
        where: { id },
      });
      if (!current) throw new NotFoundException('Không tìm thấy nguyên liệu.');
      if (isToppingName(input.name) && !isToppingName(current.name)) {
        throw new ConflictException('Tên nguyên liệu dành riêng cho topping.');
      }
      if (isToppingName(current.name) && input.name.trim() !== current.name) {
        throw new BadRequestException(
          'Không thể đổi tên nguyên liệu đang cấu hình cho topping.',
        );
      }
    }
    try {
      return response(
        await this.prisma.ingredient.update({
          where: { id },
          data: {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.minStock !== undefined
              ? { minStock: input.minStock }
              : {}),
          },
        }),
      );
    } catch (error) {
      this.rethrow(error);
    }
  }

  async restock(
    id: number,
    quantity: number,
    actorId: number,
    reason = 'Nhập kho',
    key?: string,
  ) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647)
      throw new BadRequestException('Số lượng nhập không hợp lệ.');
    return this.changeStock(
      id,
      actorId,
      'RESTOCK',
      quantity,
      undefined,
      reason,
      key,
    );
  }

  async adjust(
    id: number,
    input: AdjustIngredientDto,
    actorId: number,
    key?: string,
  ) {
    if (
      !Number.isInteger(input.stock) ||
      input.stock < 0 ||
      input.stock > 2147483647 ||
      !Number.isInteger(input.expectedVersion) ||
      input.expectedVersion < 0 ||
      input.expectedVersion > 2147483647
    )
      throw new BadRequestException('Tồn kho hoặc phiên bản không hợp lệ.');
    return this.changeStock(
      id,
      actorId,
      'ADJUST',
      input.stock,
      input.expectedVersion,
      input.reason,
      key,
    );
  }

  private async changeStock(
    id: number,
    actorId: number,
    kind: 'RESTOCK' | 'ADJUST',
    value: number,
    expectedVersion: number | undefined,
    rawReason: string,
    key?: string,
  ) {
    const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
    if (!reason || reason.length > 300)
      throw new BadRequestException('Nhập lý do từ 1 đến 300 ký tự.');
    if (!Number.isInteger(actorId) || actorId < 1)
      throw new BadRequestException('Thiếu người thao tác.');
    if (key !== undefined && !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new BadRequestException('Idempotency-Key không hợp lệ.');
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ id, kind, value, expectedVersion, reason }))
      .digest('hex');
    return this.prisma.$transaction(async (tx) => {
      // Serialize keys for the same actor even when they target different ingredients.
      // The ingredient lock also coordinates with order reservation/consumption updates.
      if (key)
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(1431194708, ${actorId})`;
      if (key) {
        const previous = await tx.inventoryMovement.findUnique({
          where: { actorId_idempotencyKey: { actorId, idempotencyKey: key } },
        });
        if (previous) {
          if (previous.requestHash !== requestHash)
            throw new ConflictException(
              'Khóa yêu cầu đã được dùng với nội dung khác.',
            );
          const current = await tx.ingredient.findUnique({ where: { id } });
          if (!current)
            throw new NotFoundException('Không tìm thấy nguyên liệu.');
          return response(current);
        }
      }
      const rows = await tx.$queryRaw<
        Ingredient[]
      >`SELECT * FROM "Ingredient" WHERE id = ${id} FOR UPDATE`;
      const current = rows[0];
      if (!current) throw new NotFoundException('Không tìm thấy nguyên liệu.');
      if (kind === 'ADJUST' && current.version !== expectedVersion)
        throw new ConflictException(
          'Tồn kho đã thay đổi. Tải lại nguyên liệu rồi kiểm tra lại số lượng.',
        );
      const nextStock = kind === 'RESTOCK' ? current.stock + value : value;
      if (nextStock > 2147483647)
        throw new BadRequestException('Số lượng nhập vượt giới hạn tồn kho.');
      if (nextStock < current.reserved)
        throw new BadRequestException(
          'Tồn thực không được thấp hơn số lượng đang giữ cho đơn hàng.',
        );
      const updated = await tx.ingredient.update({
        where: { id },
        data: { stock: nextStock, version: { increment: 1 } },
      });
      await tx.inventoryMovement.create({
        data: {
          ingredientId: id,
          actorId,
          kind,
          delta: nextStock - current.stock,
          stockBefore: current.stock,
          stockAfter: nextStock,
          reason,
          idempotencyKey: key,
          requestHash,
        },
      });
      return response(updated);
    });
  }

  async movements(id: number, page = 1) {
    if (!Number.isInteger(page) || page < 1 || page > 2147483647)
      throw new BadRequestException('Trang lịch sử không hợp lệ.');
    const limit = 20;
    return this.prisma.$transaction(
      async (tx) => {
        if (
          !(await tx.ingredient.findUnique({
            where: { id },
            select: { id: true },
          }))
        )
          throw new NotFoundException('Không tìm thấy nguyên liệu.');
        const total = await tx.inventoryMovement.count({
          where: { ingredientId: id },
        });
        const data = await tx.inventoryMovement.findMany({
          where: { ingredientId: id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            ingredientId: true,
            kind: true,
            delta: true,
            stockBefore: true,
            stockAfter: true,
            reason: true,
            createdAt: true,
            actor: { select: { id: true, name: true, email: true } },
          },
        });
        return {
          data,
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async remove(id: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          Ingredient[]
        >`SELECT * FROM "Ingredient" WHERE id = ${id} FOR UPDATE`;
        const item = rows[0];
        if (!item) throw new NotFoundException('Không tìm thấy nguyên liệu.');
        if (isToppingName(item.name))
          throw new ConflictException(
            'Không thể xóa nguyên liệu topping hệ thống.',
          );
        const used = await tx.ingredient.findUnique({
          where: { id },
          select: {
            _count: {
              select: { recipes: true, orderUses: true, movements: true },
            },
          },
        });
        if (
          item.reserved > 0 ||
          !used ||
          Object.values(used._count).some((count) => count > 0)
        )
          throw new ConflictException(
            'Nguyên liệu đã có công thức, đơn hàng hoặc lịch sử kho; không thể xóa.',
          );
        await tx.ingredient.delete({ where: { id } });
        return { id, deleted: true };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      )
        throw new ConflictException(
          'Nguyên liệu đang được sử dụng; không thể xóa.',
        );
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new ConflictException('Tên nguyên liệu đã tồn tại.');
      if (error.code === 'P2025')
        throw new NotFoundException('Không tìm thấy nguyên liệu.');
    }
    throw error;
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
