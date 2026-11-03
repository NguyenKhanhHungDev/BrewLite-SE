import { isObject } from "./api";

export type Ingredient = {
  id: number;
  name: string;
  unit: "g" | "ml";
  stock: number;
  reserved: number;
  available: number;
  minStock: number;
};
export function parseIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value))
    throw new Error("Dữ liệu nguyên liệu không hợp lệ.");
  const seen = new Set<number>();
  return value.map((item: unknown) => {
    if (
      !isObject(item) ||
      !Number.isSafeInteger(item.id) ||
      Number(item.id) < 1 ||
      seen.has(Number(item.id)) ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      (item.unit !== "g" && item.unit !== "ml") ||
      ![item.stock, item.reserved, item.minStock].every(
        (n) => Number.isSafeInteger(n) && Number(n) >= 0,
      ) ||
      item.available !== Number(item.stock) - Number(item.reserved)
    ) {
      throw new Error("Dữ liệu nguyên liệu không hợp lệ.");
    }
    seen.add(Number(item.id));
    return item as Ingredient;
  });
}
