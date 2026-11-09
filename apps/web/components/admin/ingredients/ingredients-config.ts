import { type Ingredient } from "@/lib/ingredients";
import { type InventoryFilters } from "@/lib/inventory-admin";
export type IngredientEdit = {
  mode: "create" | "edit" | "restock" | "adjust" | "delete" | "history";
  item?: Ingredient;
};
export const statusLabels = {
  empty: "Hết khả dụng",
  low: "Sắp hết",
  ok: "Còn hàng",
};
export const initialFilters: InventoryFilters = {
  query: "",
  unit: "all",
  status: "all",
  sort: "name",
};
export const topping = (item: Ingredient) =>
  ["trân châu", "kem sữa"].includes(item.name.trim().toLocaleLowerCase("vi"));
