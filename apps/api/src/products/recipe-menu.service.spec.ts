import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type {
  RecipeRecord,
  RecipesRepository,
} from '../recipes/recipes.contract.js';
import { recipeToProduct, RecipeMenuService } from './recipe-menu.service.js';

const recipe = (): RecipeRecord => ({
  id: 7,
  name: 'Cà phê sữa',
  price: 35000,
  imageUrl: '/images/products/ca-phe-sua.jpg',
  isActive: true,
  category: 'COFFEE',
  ingredients: [
    {
      ingredientId: 12,
      quantity: 20,
      ingredient: { name: 'Cà phê bột', unit: 'g', stock: 240, reserved: 40 },
    },
    {
      ingredientId: 23,
      quantity: 30,
      ingredient: { name: 'Sữa đặc', unit: 'ml', stock: 180, reserved: 30 },
    },
  ],
});

describe('Recipe menu preparation', () => {
  it('preserves frontend shape and takes the limiting ingredient after reservations', () => {
    expect(recipeToProduct(recipe())).toEqual({
      id: 7,
      name: 'Cà phê sữa',
      price: 35000,
      imageUrl: '/images/products/ca-phe-sua.jpg',
      category: 'COFFEE',
      stock: 5,
      stockBySize: { S: 6, M: 5, L: 4 },
    });
  });

  it.each([0, 29, 30, 59])('floors available stock %i', (stock) => {
    const data = recipe();
    data.ingredients[1].ingredient = {
      ...data.ingredients[1].ingredient,
      stock,
      reserved: 0,
    };
    expect(recipeToProduct(data).stock).toBe(Math.floor(stock / 30));
  });

  it('clamps available inventory to zero', () => {
    const data = recipe();
    data.ingredients[0].ingredient.reserved = 300;
    expect(recipeToProduct(data).stock).toBe(0);
  });

  it('rejects an empty recipe', () => {
    expect(() => recipeToProduct({ ...recipe(), ingredients: [] })).toThrow(
      InternalServerErrorException,
    );
  });

  it.each([-1, 0, 0.5, NaN, Infinity])(
    'rejects invalid quantity %s',
    (quantity) => {
      const data = recipe();
      data.ingredients[0].quantity = quantity;
      expect(() => recipeToProduct(data)).toThrow(InternalServerErrorException);
    },
  );

  it.each(['stock', 'reserved'] as const)('rejects negative %s', (field) => {
    const data = recipe();
    data.ingredients[0].ingredient[field] = -1;
    expect(() => recipeToProduct(data)).toThrow(InternalServerErrorException);
  });

  it('rejects duplicate ingredients', () => {
    const data = recipe();
    data.ingredients.push(data.ingredients[0]);
    expect(() => recipeToProduct(data)).toThrow(InternalServerErrorException);
  });

  it('filters hidden recipes and sorts menu by id', async () => {
    const repository = {
      findAll: async () => [
        { ...recipe(), id: 9 },
        { ...recipe(), isActive: false },
        recipe(),
      ],
    } as RecipesRepository;
    expect(
      (await new RecipeMenuService(repository).findAll()).map(
        (item) => item.id,
      ),
    ).toEqual([7, 9]);
  });

  it.each([null, { ...recipe(), isActive: false }])(
    'returns 404 for missing/hidden recipes',
    async (data) => {
      const repository = { findById: async () => data } as RecipesRepository;
      await expect(
        new RecipeMenuService(repository).findOne(7),
      ).rejects.toThrow(NotFoundException);
    },
  );
});

it('keeps size S available when stock cannot make size M', () => {
  const data = recipe();
  data.ingredients = [
    {
      ingredientId: 1,
      quantity: 20,
      ingredient: { name: 'Test', unit: 'g', stock: 16, reserved: 0 },
    },
  ];
  expect(recipeToProduct(data)).toMatchObject({
    stock: 0,
    stockBySize: { S: 1, M: 0, L: 0 },
  });
});
