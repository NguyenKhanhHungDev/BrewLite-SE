"use client";
import { useAdminList } from "@/components/admin/useAdminList";
import { parseIngredients, type Ingredient } from "@/lib/ingredients";
import { inventoryRows, type InventoryFilters } from "@/lib/inventory-admin";
import { useState } from "react";
import { IngredientEdit, initialFilters } from "./ingredients-config";
/** State, API calls and mutation rules for the ingredients screen. */
export function useAdminIngredients() {
  const list = useAdminList("/ingredients", parseIngredients);
  const [edit, setEdit] = useState<IngredientEdit | null>(null);
  const [success, setSuccess] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [requestedPage, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const all = list.data ?? [];
  const rows = inventoryRows(all, filters);
  const totalPages = Math.max(1, Math.ceil(rows.length / limit));
  const page = Math.min(requestedPage, totalPages);
  const visible = rows.slice((page - 1) * limit, page * limit);
  const filter = (value: Partial<InventoryFilters>) => {
    setFilters((old) => ({ ...old, ...value }));
    setPage(1);
  };
  const open = (mode: IngredientEdit["mode"], item?: Ingredient) => {
    setSuccess("");
    setEdit({ mode, item });
  };
  const saved = () => {
    setEdit(null);
    setSuccess("Đã cập nhật nguyên liệu.");
    list.reload();
  };

  return {
    list,
    edit,
    setEdit,
    success,
    filters,
    setFilters,
    setPage,
    limit,
    setLimit,
    all,
    rows,
    totalPages,
    page,
    visible,
    filter,
    open,
    saved,
  };
}
export type IngredientsModel = ReturnType<typeof useAdminIngredients>;
