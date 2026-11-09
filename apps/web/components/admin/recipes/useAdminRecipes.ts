"use client";
import { useAdminList } from "@/components/admin/useAdminList";
import { useAuth } from "@/components/AuthProvider";
import { matchesSearch } from "@/lib/admin-tools";
import { parseIngredients } from "@/lib/ingredients";
import { parseRecipes, type Recipe } from "@/lib/recipes";
import { useState } from "react";
/** State, API calls and mutation rules for the recipes screen. */
export function useAdminRecipes() {
  const list = useAdminList("/recipes", parseRecipes),
    ingredients = useAdminList("/ingredients", parseIngredients);
  const [edit, setEdit] = useState<Recipe | null | undefined>(undefined),
    [success, setSuccess] = useState("");
  const { request } = useAuth();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [categoryFilter, setCategoryFilter] = useState("ALL"),
    [sort, setSort] = useState("name"),
    [page, setPage] = useState(1);
  const [clone, setClone] = useState(false),
    [busyId, setBusyId] = useState<number | null>(null),
    [actionError, setActionError] = useState("");
  const filtered = (list.data ?? [])
    .filter(
      (item) =>
        matchesSearch(`${item.id} ${item.name}`, query) &&
        (filter === "ALL" || item.isActive === (filter === "ACTIVE")) &&
        (categoryFilter === "ALL" || item.category === categoryFilter),
    )
    .sort((a, b) =>
      sort === "price"
        ? a.price - b.price
        : sort === "id"
          ? b.id - a.id
          : a.name.localeCompare(b.name, "vi"),
    );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, totalPages);
  async function toggle(item: Recipe) {
    if (
      busyId !== null ||
      !window.confirm(
        `${item.isActive ? "Ngừng bán" : "Mở bán"} món “${item.name}”?`,
      )
    )
      return;
    setBusyId(item.id);
    setActionError("");
    try {
      await request(`/recipes/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      setSuccess("Đã cập nhật trạng thái bán.");
      list.reload();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Không cập nhật được trạng thái.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return {
    list,
    ingredients,
    edit,
    setEdit,
    success,
    setSuccess,
    query,
    setQuery,
    filter,
    setFilter,
    categoryFilter,
    setCategoryFilter,
    sort,
    setSort,
    setPage,
    clone,
    setClone,
    busyId,
    actionError,
    filtered,
    totalPages,
    currentPage,
    toggle,
  };
}
export type RecipesModel = ReturnType<typeof useAdminRecipes>;
