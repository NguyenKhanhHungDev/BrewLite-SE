"use client";
import { useAuth } from "@/components/AuthProvider";
import { type Ingredient } from "@/lib/ingredients";
import { type Category } from "@/lib/menu";
import { type Recipe } from "@/lib/recipes";
import { useRef, useState, type FormEvent } from "react";
export type RecipeFormProps = {
  item: Recipe | null;
  clone: boolean;
  ingredients: Ingredient[];
  close: () => void;
  saved: () => void;
};
/** Draft fields, validation and API submission for this form. */
export function useRecipeForm({
  item,
  clone,
  ingredients,
  saved,
}: RecipeFormProps) {
  const { request } = useAuth();
  const [name, setName] = useState(
      clone && item ? `${item.name} (bản sao)` : (item?.name ?? ""),
    ),
    [price, setPrice] = useState(String(item?.price ?? "")),
    [imageUrl, setImage] = useState(item?.imageUrl ?? ""),
    [active, setActive] = useState(item?.isActive ?? true);
  const [category, setCategory] = useState<Category>(item?.category ?? "OTHER");
  const [rows, setRows] = useState(
    item?.ingredients.map((row) => ({
      ingredientId: String(row.ingredientId),
      quantity: String(row.quantity),
    })) ?? [{ ingredientId: "", quantity: "" }],
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (
        !name.trim() ||
        !Number.isInteger(Number(price)) ||
        Number(price) <= 0 ||
        Number(price) > 2147483647
      )
        throw new Error("Tên hoặc giá không hợp lệ.");
      if (
        !/^\/images\/products\/[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/.test(
          imageUrl.trim(),
        )
      )
        throw new Error("Ảnh cần có dạng /images/products/ten-mon.jpg.");
      const selected = rows.map((row) => ({
        ingredientId: Number(row.ingredientId),
        quantity: Number(row.quantity),
      }));
      if (
        !selected.length ||
        new Set(selected.map((row) => row.ingredientId)).size !==
          selected.length ||
        selected.some(
          (row) =>
            !ingredients.some((i) => i.id === row.ingredientId) ||
            !Number.isInteger(row.quantity) ||
            row.quantity <= 0 ||
            row.quantity > 2147483647,
        )
      )
        throw new Error(
          "Chọn nguyên liệu không trùng và định lượng nguyên dương.",
        );
      await request(item && !clone ? `/recipes/${item.id}` : "/recipes", {
        method: item && !clone ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          price: Number(price),
          imageUrl: imageUrl.trim(),
          isActive: active,
          category,
          ingredients: selected,
        }),
      });
      saved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không lưu được công thức.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return {
    name,
    setName,
    price,
    setPrice,
    imageUrl,
    setImage,
    active,
    setActive,
    category,
    setCategory,
    rows,
    setRows,
    error,
    busy,
    submit,
  };
}
