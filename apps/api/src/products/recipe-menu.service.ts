import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { RecipeRecord, RecipesRepository } from '../recipes/recipes.contract.js';

export function recipeToProduct(recipe: RecipeRecord) {
  const seen = new Set<number>();
  if (!recipe.ingredients.length) throw new InternalServerErrorException('Recipe has no ingredients');
  const stock = Math.min(...recipe.ingredients.map(({ ingredientId, quantity, ingredient }) => {
    if (seen.has(ingredientId) || !Number.isSafeInteger(quantity) || quantity <= 0 ||
      !ingredient || !Number.isSafeInteger(ingredient.stock) || ingredient.stock < 0 ||
      !Number.isSafeInteger(ingredient.reserved) || ingredient.reserved < 0) {
      throw new InternalServerErrorException('Invalid recipe inventory');
    }
    seen.add(ingredientId);
    return Math.floor(Math.max(0, ingredient.stock - ingredient.reserved) / quantity);
  }));
  return { id: recipe.id, name: recipe.name, price: recipe.price, imageUrl: recipe.imageUrl, stock };
}

// Activate only together with Recipe-based Orders and authenticated admin routes.
export class RecipeMenuService {
  constructor(private readonly repository: RecipesRepository) {}

  async findAll() {
    return (await this.repository.findAll()).filter((recipe) => recipe.isActive)
      .sort((a, b) => a.id - b.id).map(recipeToProduct);
  }

  async findOne(id: number) {
    const recipe = await this.repository.findById(id);
    if (!recipe?.isActive) throw new NotFoundException('Product not found');
    return recipeToProduct(recipe);
  }
}
