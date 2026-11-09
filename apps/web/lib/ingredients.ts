import { isObject } from "./api";

export type Ingredient = {
  id: number;
  name: string;
  unit: "g" | "ml";
  stock: number;
  reserved: number;
  available: number;
  minStock: number;
  version?: number;
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
      (item.version !== undefined &&
        (!Number.isSafeInteger(item.version) || Number(item.version) < 0)) ||
      item.available !== Number(item.stock) - Number(item.reserved)
    ) {
      throw new Error("Dữ liệu nguyên liệu không hợp lệ.");
    }
    seen.add(Number(item.id));
    return item as Ingredient;
  });
}

export type InventoryMovement = {
  id: number;
  ingredientId: number;
  kind: "RESTOCK" | "ADJUST";
  delta: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  createdAt: string;
  actor: { id: number; name: string | null; email: string };
};
export type InventoryHistory = {
  data: InventoryMovement[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
export function parseInventoryHistory(value: unknown): InventoryHistory {
  const invalid = () => {
    throw new Error("Dữ liệu lịch sử kho không hợp lệ.");
  };
  if (
    !isObject(value) ||
    !Array.isArray(value.data) ||
    ![value.page, value.limit, value.totalPages].every(
      (n) => Number.isSafeInteger(n) && Number(n) > 0,
    ) ||
    !Number.isSafeInteger(value.total) ||
    Number(value.total) < 0 ||
    Number(value.data.length) > Number(value.limit) ||
    value.totalPages !==
      Math.max(1, Math.ceil(Number(value.total) / Number(value.limit)))
  )
    return invalid();
  const seen = new Set<number>();
  for (const row of value.data) {
    if (
      !isObject(row) ||
      ![row.id, row.ingredientId].every(
        (n) => Number.isSafeInteger(n) && Number(n) > 0,
      ) ||
      seen.has(Number(row.id)) ||
      (row.kind !== "RESTOCK" && row.kind !== "ADJUST") ||
      !Number.isSafeInteger(row.delta) ||
      ![row.stockBefore, row.stockAfter].every(
        (n) => Number.isSafeInteger(n) && Number(n) >= 0,
      ) ||
      row.delta !== Number(row.stockAfter) - Number(row.stockBefore) ||
      typeof row.reason !== "string" ||
      !row.reason.trim() ||
      typeof row.createdAt !== "string" ||
      !Number.isFinite(Date.parse(row.createdAt)) ||
      !isObject(row.actor) ||
      !Number.isSafeInteger(row.actor.id) ||
      Number(row.actor.id) < 1 ||
      (row.actor.name !== null && typeof row.actor.name !== "string") ||
      typeof row.actor.email !== "string"
    )
      return invalid();
    seen.add(Number(row.id));
  }
  return value as InventoryHistory;
}
