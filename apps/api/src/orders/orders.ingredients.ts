import { BadRequestException } from '@nestjs/common';
import type {
  IngredientSnapshot,
  RecipeSnapshot,
  Size,
  Topping,
} from './orders.contract.js';

export interface IngredientNeedInput {
  recipe: RecipeSnapshot;
  quantity: number;
  size: Size;
  toppings: Topping[];
}

export interface IngredientNeed {
  ingredientId: number;
  quantity: number;
}

export interface ToppingIngredients {
  pearl: IngredientSnapshot | null;
  cream: IngredientSnapshot | null;
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new BadRequestException(`${label} phải là số dương hợp lệ`);
  }
}

function quantityForSize(baseQuantity: number, size: Size): number {
  const multiplier = size === 'S' ? 0.8 : size === 'L' ? 1.2 : 1;
  const result = size === 'M' ? baseQuantity : Math.ceil(baseQuantity * multiplier);
  assertPositiveFinite(result, 'Định lượng nguyên liệu');
  return result;
}

function addNeed(needs: Map<number, number>, ingredientId: number, amount: number) {
  assertPositiveFinite(ingredientId, 'ingredientId');
  assertPositiveFinite(amount, 'Định lượng nguyên liệu');
  const next = (needs.get(ingredientId) ?? 0) + amount;
  if (!Number.isFinite(next)) {
    throw new BadRequestException('Định lượng nguyên liệu vượt giới hạn');
  }
  needs.set(ingredientId, next);
}

function validateToppingIngredient(
  ingredient: IngredientSnapshot | null,
  topping: Topping,
): IngredientSnapshot {
  if (!ingredient) {
    throw new BadRequestException(
      `Chưa cấu hình nguyên liệu cho topping ${topping}`,
    );
  }
  if (
    !Number.isSafeInteger(ingredient.id) ||
    ingredient.id <= 0 ||
    !['g', 'ml'].includes(ingredient.unit.trim().toLowerCase())
  ) {
    throw new BadRequestException(`Nguyên liệu topping ${topping} không hợp lệ`);
  }
  return ingredient;
}

/**
 * Calculate one aggregated requirement per ingredient for the whole order.
 * Recipe quantities are stored for size M; size conversion is rounded up per
 * recipe-ingredient line before multiplying by the number of cups.
 */
export function calculateIngredientNeeds(
  items: IngredientNeedInput[],
  toppings: ToppingIngredients,
): IngredientNeed[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestException('Đơn hàng phải có ít nhất một món');
  }

  const needs = new Map<number, number>();

  for (const item of items) {
    assertPositiveFinite(item.quantity, 'quantity');
    if (!['S', 'M', 'L'].includes(item.size)) {
      throw new BadRequestException('size phải là S, M hoặc L');
    }
    if (!item.recipe?.isActive) {
      throw new BadRequestException(`Món ${item.recipe?.id ?? ''} không còn kinh doanh`);
    }
    if (!Array.isArray(item.recipe.ingredients) || item.recipe.ingredients.length === 0) {
      throw new BadRequestException(`Công thức ${item.recipe.id} chưa có nguyên liệu`);
    }

    for (const line of item.recipe.ingredients) {
      if (
        !Number.isSafeInteger(line.ingredientId) ||
        line.ingredientId <= 0 ||
        !Number.isFinite(line.quantity) ||
        line.quantity <= 0 ||
        !line.ingredient ||
        line.ingredient.id !== line.ingredientId ||
        typeof line.ingredient.name !== 'string' ||
        !line.ingredient.name.trim() ||
        typeof line.ingredient.unit !== 'string' ||
        !['g', 'ml'].includes(line.ingredient.unit.trim().toLowerCase())
      ) {
        throw new BadRequestException(`Công thức ${item.recipe.id} có định lượng không hợp lệ`);
      }
      const perCup = quantityForSize(line.quantity, item.size);
      const total = perCup * item.quantity;
      if (!Number.isFinite(total)) {
        throw new BadRequestException('Định lượng nguyên liệu vượt giới hạn');
      }
      addNeed(needs, line.ingredientId, total);
    }

    for (const topping of item.toppings) {
      const toppingIngredient = topping === 'PEARL'
        ? validateToppingIngredient(toppings.pearl, topping)
        : validateToppingIngredient(toppings.cream, topping);
      const expectedUnit = topping === 'PEARL' ? 'g' : 'ml';
      if (toppingIngredient.unit.trim().toLowerCase() !== expectedUnit) {
        throw new BadRequestException(`Đơn vị nguyên liệu topping ${topping} không hợp lệ`);
      }
      addNeed(needs, toppingIngredient.id, 20 * item.quantity);
    }
  }

  return [...needs.entries()]
    .map(([ingredientId, quantity]) => ({ ingredientId, quantity }))
    .sort((a, b) => a.ingredientId - b.ingredientId);
}

export function assertIngredientAvailability(
  needs: IngredientNeed[],
  ingredients: Map<number, IngredientSnapshot>,
): void {
  for (const need of needs) {
    const ingredient = ingredients.get(need.ingredientId);
    if (
      !ingredient ||
      !Number.isFinite(ingredient.stock) ||
      !Number.isFinite(ingredient.reserved) ||
      ingredient.stock < 0 ||
      ingredient.reserved < 0
    ) {
      throw new BadRequestException('Dữ liệu tồn kho nguyên liệu không hợp lệ');
    }
    if (ingredient.stock - ingredient.reserved < need.quantity) {
      throw new BadRequestException(`Không đủ nguyên liệu: ${ingredient.name}`);
    }
  }
}
