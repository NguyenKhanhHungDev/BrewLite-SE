import type { Ingredient } from "./ingredients";
import { matchesSearch } from "./admin-tools";
export type InventoryFilters = {
  query: string;
  unit: "all" | "g" | "ml";
  status: "all" | "low" | "empty" | "ok";
  sort: "name" | "id" | "available-asc" | "available-desc";
};
export function inventoryStatus(row: Ingredient): "empty" | "low" | "ok" {
  return row.available <= 0
    ? "empty"
    : row.available <= row.minStock
      ? "low"
      : "ok";
}
export function inventoryRows(rows: Ingredient[], filters: InventoryFilters) {
  return rows
    .filter(
      (row) =>
        matchesSearch(`${row.id} ${row.name}`, filters.query) &&
        (filters.unit === "all" || row.unit === filters.unit) &&
        (filters.status === "all" ||
          (filters.status === "low"
            ? row.available <= row.minStock
            : inventoryStatus(row) === filters.status)),
    )
    .sort(
      (a, b) =>
        (filters.sort === "id"
          ? a.id - b.id
          : filters.sort === "available-asc"
            ? a.available - b.available
            : filters.sort === "available-desc"
              ? b.available - a.available
              : a.name.localeCompare(b.name, "vi")) || a.id - b.id,
    );
}
export function inventoryInteger(value: string, min: number) {
  const number = Number(value);
  if (
    !value.trim() ||
    !Number.isSafeInteger(number) ||
    number < min ||
    number > 2147483647
  )
    throw new Error("Số lượng phải là số nguyên trong giới hạn cho phép.");
  return number;
}
export type InventoryRequestIdentity = { signature: string; key: string };
export function stableInventoryRequest(
  previous: InventoryRequestIdentity | undefined,
  signature: string,
  generate: () => string,
): InventoryRequestIdentity {
  return previous?.signature === signature
    ? previous
    : { signature, key: generate() };
}
