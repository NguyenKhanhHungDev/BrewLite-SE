import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import type { RecipesPrismaAdapter } from '../recipes/recipes.prisma-adapter.js';

describe('Recipe-backed ProductsService', () => {
  const recipe = {
    id: 17,
    name: 'Coffee',
    price: 35000,
    imageUrl: '/images/products/ca-phe-sua.jpg',
    isActive: true,
    ingredients: [
      {
        ingredientId: 3,
        quantity: 20,
        ingredient: { name: 'Coffee', unit: 'g', stock: 200, reserved: 40 },
      },
    ],
  };
  it('returns Recipe IDs with available inventory, excluding inactive recipes', async () => {
    const repository = {
      findAll: vi
        .fn()
        .mockResolvedValue([recipe, { ...recipe, id: 18, isActive: false }]),
    };
    const service = new ProductsService(
      repository as unknown as RecipesPrismaAdapter,
    );
    await expect(service.findAll()).resolves.toEqual([
      {
        id: 17,
        name: 'Coffee',
        price: 35000,
        imageUrl: '/images/products/ca-phe-sua.jpg',
        stock: 8,
        stockBySize: { S: 10, M: 8, L: 6 },
      },
    ]);
  });
  it('returns 404 for missing or inactive recipes', async () => {
    const repository = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...recipe, isActive: false }),
    };
    const service = new ProductsService(
      repository as unknown as RecipesPrismaAdapter,
    );
    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findOne(17)).rejects.toBeInstanceOf(NotFoundException);
  });
});
