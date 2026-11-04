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
import type { CreateIngredientDto } from './dto/create-ingredient.dto.js';
import type { UpdateIngredientDto } from './dto/update-ingredient.dto.js';

function response({ id, name, unit, stock, reserved, minStock }: Ingredient) {
  return {
    id,
    name,
    unit,
    stock,
    reserved,
    available: stock - reserved,
    minStock,
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
      if (
        ['Trân châu', 'Kem sữa'].some(
          (name) =>
            name.toLocaleLowerCase('vi') ===
            current.name.toLocaleLowerCase('vi'),
        ) &&
        input.name.trim() !== current.name
      ) {
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

  async restock(id: number, quantity: number) {
    const result = await this.prisma.ingredient.updateMany({
      where: { id, stock: { lte: 2147483647 - quantity } },
      data: { stock: { increment: quantity }, version: { increment: 1 } },
    });
    if (!result.count) {
      const item = await this.prisma.ingredient.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Không tìm thấy nguyên liệu.');
      throw new BadRequestException('Số lượng nhập vượt giới hạn tồn kho.');
    }
    const item = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy nguyên liệu.');
    return response(item);
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
