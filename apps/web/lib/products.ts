import { isCategory, type Category } from "./menu";

export type Product = {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
  category?: Category;
  stockBySize?: Record<"S" | "M" | "L", number>;
};

export type ProductStockStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK";

export function parseProduct(value: unknown): Product {
  const products = parseProducts([value]);
  return products[0];
}

export function parseProducts(value: unknown): Product[] {
  if (!Array.isArray(value)) throw new Error("Invalid products response");
  const ids = new Set<number>();
  return value.map((item: unknown) => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("id" in item) ||
      typeof item.id !== "number" ||
      !Number.isSafeInteger(item.id) ||
      item.id <= 0 ||
      ids.has(item.id) ||
      !("name" in item) ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      !("price" in item) ||
      typeof item.price !== "number" ||
      !Number.isSafeInteger(item.price) ||
      item.price < 0 ||
      !("imageUrl" in item) ||
      typeof item.imageUrl !== "string" ||
      !("stock" in item) ||
      typeof item.stock !== "number" ||
      !Number.isSafeInteger(item.stock) ||
      item.stock < 0
    )
      throw new Error("Invalid product fields");
    const category = "category" in item ? item.category : undefined;
    if (category !== undefined && !isCategory(category))
      throw new Error("Invalid product category");
    const sizes = "stockBySize" in item ? item.stockBySize : undefined;
    if (
      sizes !== undefined &&
      (typeof sizes !== "object" ||
        sizes === null ||
        !["S", "M", "L"].every((size) => {
          const n = (sizes as Record<string, unknown>)[size];
          return typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
        }))
    )
      throw new Error("Invalid size stock");
    ids.add(item.id);
    return {
      id: item.id,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
      stock: item.stock,
      category: category ?? "OTHER",
      ...(sizes
        ? { stockBySize: sizes as Record<"S" | "M" | "L", number> }
        : {}),
    };
  });
}
