import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CreateIngredientDto } from './dto/create-ingredient.dto.js';
import { UpdateIngredientDto } from './dto/update-ingredient.dto.js';
import { RestockIngredientDto } from './dto/restock-ingredient.dto.js';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const create = { name: ' Cà phê ', unit: 'g', stock: 100, minStock: 10 };
const validate = (body: unknown, metatype: new () => object) =>
  pipe.transform(body, { type: 'body', metatype });

describe('Ingredients request validation', () => {
  it('trims names and accepts only the creation fields', async () => {
    expect(await validate(create, CreateIngredientDto)).toMatchObject({
      ...create,
      name: 'Cà phê',
    });
  });
  it.each([
    { name: '' },
    { name: '   ' },
    { name: null },
    { unit: 'kg' },
    { stock: -1 },
    { stock: 1.5 },
    { stock: null },
    { stock: '100' },
    { stock: 2147483648 },
    { minStock: -1 },
    { minStock: null },
    { reserved: 0 },
    { available: 100 },
  ])('rejects invalid creation fields %j', async (change) => {
    await expect(
      validate({ ...create, ...change }, CreateIngredientDto),
    ).rejects.toThrow();
  });
  it.each([
    { stock: 1 },
    { reserved: 1 },
    { unit: 'ml' },
    { name: null },
    { minStock: null },
  ])('rejects forbidden/null edits %j', async (body) => {
    await expect(validate(body, UpdateIngredientDto)).rejects.toThrow();
  });
  it('accepts updating only the threshold', async () => {
    expect(await validate({ minStock: 0 }, UpdateIngredientDto)).toMatchObject({
      minStock: 0,
    });
  });
  it.each([0, -1, 1.5, null, '1', 2147483648])(
    'rejects restock quantity %j',
    async (quantity) => {
      await expect(
        validate({ quantity }, RestockIngredientDto),
      ).rejects.toThrow();
    },
  );
});

describe('Protected topping ingredients', () => {
  it.each(['Trân châu', 'Kem sữa'])(
    'rejects renaming %s without updating the row',
    async (name) => {
      const { IngredientsService } = await import('./ingredients.service.js');
      const { vi } = await import('vitest');
      const update = vi.fn();
      const service = Object.create(IngredientsService.prototype);
      Object.defineProperty(service, 'prisma', {
        value: {
          ingredient: {
            findUnique: vi.fn().mockResolvedValue({ id: 1, name }),
            update,
          },
        },
      });
      await expect(service.update(1, { name: 'Tên mới' })).rejects.toThrow(
        'topping',
      );
      expect(update).not.toHaveBeenCalled();
    },
  );
});
