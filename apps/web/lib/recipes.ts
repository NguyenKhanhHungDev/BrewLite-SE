import { isObject } from "./api";
import { isCategory, type Category } from "./menu";

export type Recipe = {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  isActive: boolean;
  category: Category;
  ingredients: {
    ingredientId: number;
    name: string;
    unit: "g" | "ml";
    quantity: number;
  }[];
};
export function parseRecipes(value: unknown): Recipe[] {
  if (!Array.isArray(value)) throw new Error("Dữ liệu công thức không hợp lệ.");
  const seen = new Set<number>();
  return value.map((item: unknown) => {
    if (
      !isObject(item) ||
      !Number.isSafeInteger(item.id) ||
      Number(item.id) < 1 ||
      seen.has(Number(item.id)) ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      !Number.isSafeInteger(item.price) ||
      Number(item.price) <= 0 ||
      typeof item.imageUrl !== "string" ||
      typeof item.isActive !== "boolean" ||
      !isCategory(item.category) ||
      !Array.isArray(item.ingredients) ||
      !item.ingredients.length
    ) {
      throw new Error("Dữ liệu công thức không hợp lệ.");
    }
    const ids = new Set<number>();
    for (const row of item.ingredients) {
      if (
        !isObject(row) ||
        !Number.isSafeInteger(row.ingredientId) ||
        Number(row.ingredientId) < 1 ||
        ids.has(Number(row.ingredientId)) ||
        typeof row.name !== "string" ||
        (row.unit !== "g" && row.unit !== "ml") ||
        !Number.isSafeInteger(row.quantity) ||
        Number(row.quantity) <= 0
      )
        throw new Error("Định lượng không hợp lệ.");
      ids.add(Number(row.ingredientId));
    }
    seen.add(Number(item.id));
    return item as Recipe;
  });
}
