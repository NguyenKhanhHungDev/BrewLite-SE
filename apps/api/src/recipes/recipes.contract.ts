import type { CreateRecipeDto } from './dto/create-recipe.dto.js';
import type { UpdateRecipeDto } from './dto/update-recipe.dto.js';

export interface RecipeRecord {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  isActive: boolean;
  ingredients: {
    ingredientId: number;
    quantity: number;
    ingredient: { name: string; unit: string; stock: number; reserved: number };
  }[];
}

// Implement against Khoa's approved schema only after migration is available.
// Mutations must atomically check references and replace links; map unique-name
// violations to 409 and missing ingredient references to 400/404, including races.
// Never update historical OrderItem / OrderIngredient snapshots.
export interface RecipesTransaction {
  findById(id: number): Promise<RecipeRecord | null>;
  findByName(name: string): Promise<RecipeRecord | null>;
  ingredientIdsExist(ids: number[]): Promise<boolean>;
  create(input: CreateRecipeDto): Promise<RecipeRecord>;
  update(id: number, input: UpdateRecipeDto): Promise<RecipeRecord>;
}

export interface RecipesRepository {
  findAll: () => Promise<RecipeRecord[]>;
  findById: (id: number) => Promise<RecipeRecord | null>;
  transaction: <T>(work: (tx: RecipesTransaction) => Promise<T>) => Promise<T>;
}
