import { describe, expect, it } from 'vitest';
import type { IngredientSnapshot, RecipeSnapshot } from './orders.contract.js';
import { calculateIngredientNeeds } from './orders.ingredients.js';

function ingredient(id: number, name: string, unit: string): IngredientSnapshot {
  return { id, name, unit, stock: 10_000, reserved: 0, version: 0 };
}

const coffee = ingredient(1, 'Cà phê', 'g');
const condensedMilk = ingredient(2, 'Sữa đặc', 'ml');
const pearl = ingredient(3, 'Trân châu', 'g');
const cream = ingredient(4, 'Kem sữa', 'ml');

function recipe(id: number, lines: Array<{ ingredientId: number; quantity: number; ingredient: IngredientSnapshot }> = [
  { ingredientId: coffee.id, quantity: 10, ingredient: coffee },
  { ingredientId: condensedMilk.id, quantity: 15, ingredient: condensedMilk },
]): RecipeSnapshot {
  return { id, name: `Recipe ${id}`, price: 20_000, isActive: true, ingredients: lines };
}

const toppings = { pearl, cream };

describe('calculateIngredientNeeds', () => {
  it.each([
    ['S', 16],
    ['M', 20],
    ['L', 24],
  ] as const)('calculates size %s quantities and rounds each recipe line up', (size, expectedCoffee) => {
    const result = calculateIngredientNeeds(
      [{ recipe: recipe(1), quantity: 2, size, toppings: [] }],
      toppings,
    );
    expect(result).toEqual([
      { ingredientId: 1, quantity: expectedCoffee },
      { ingredientId: 2, quantity: size === 'S' ? 24 : size === 'L' ? 36 : 30 },
    ]);
  });

  it('adds 20g pearl and 20ml cream per cup', () => {
    const result = calculateIngredientNeeds(
      [{ recipe: recipe(1), quantity: 3, size: 'M', toppings: ['PEARL', 'CREAM'] }],
      toppings,
    );
    expect(result).toEqual([
      { ingredientId: 1, quantity: 30 },
      { ingredientId: 2, quantity: 45 },
      { ingredientId: 3, quantity: 60 },
      { ingredientId: 4, quantity: 60 },
    ]);
  });

  it('groups the same ingredient across different recipes and sorts IDs', () => {
    const secondRecipe = recipe(2, [
      { ingredientId: 2, quantity: 7, ingredient: condensedMilk },
      { ingredientId: 1, quantity: 5, ingredient: coffee },
    ]);
    const result = calculateIngredientNeeds(
      [
        { recipe: recipe(1), quantity: 2, size: 'M', toppings: [] },
        { recipe: secondRecipe, quantity: 1, size: 'M', toppings: [] },
      ],
      toppings,
    );
    expect(result).toEqual([
      { ingredientId: 1, quantity: 25 },
      { ingredientId: 2, quantity: 37 },
    ]);
  });

  it('rounds each ingredient before multiplying by cup quantity', () => {
    const smallRecipe = recipe(3, [
      { ingredientId: 1, quantity: 1, ingredient: coffee },
    ]);
    const result = calculateIngredientNeeds(
      [{ recipe: smallRecipe, quantity: 3, size: 'L', toppings: [] }],
      toppings,
    );
    expect(result).toEqual([{ ingredientId: 1, quantity: 6 }]);
  });

  it('rejects inactive recipes, empty recipes, and missing topping ingredients', () => {
    expect(() => calculateIngredientNeeds(
      [{ recipe: { ...recipe(1), isActive: false }, quantity: 1, size: 'M', toppings: [] }],
      toppings,
    )).toThrow();
    expect(() => calculateIngredientNeeds(
      [{ recipe: recipe(2, []), quantity: 1, size: 'M', toppings: [] }],
      toppings,
    )).toThrow();
    expect(() => calculateIngredientNeeds(
      [{ recipe: recipe(1), quantity: 1, size: 'M', toppings: ['PEARL'] }],
      { pearl: null, cream },
    )).toThrow();
  });

  it('rejects invalid quantities and topping units', () => {
    expect(() => calculateIngredientNeeds(
      [{ recipe: recipe(1), quantity: 0, size: 'M', toppings: [] }],
      toppings,
    )).toThrow();
    expect(() => calculateIngredientNeeds(
      [{ recipe: recipe(1), quantity: 1, size: 'M', toppings: ['PEARL'] }],
      { pearl: ingredient(9, 'Trân châu', 'ml'), cream },
    )).toThrow();
  });
});
