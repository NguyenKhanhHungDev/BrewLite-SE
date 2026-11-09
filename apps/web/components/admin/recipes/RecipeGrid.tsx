"use client";
import ProductImage from "@/components/ProductImage";
import { categories } from "@/lib/menu";
import { money } from "@/lib/pricing";
import type { RecipesModel } from "./useAdminRecipes";
export default function RecipeGrid({ model }: { model: RecipesModel }) {
  const {
    ingredients,
    setEdit,
    setSuccess,
    setClone,
    busyId,
    filtered,
    currentPage,
    toggle,
  } = model;
  return (
    <>
      <div className="bl-admin-cards">
        {filtered
          .slice((currentPage - 1) * 12, currentPage * 12)
          .map((item) => (
            <section className="bl-panel" key={item.id}>
              <div className="bl-product-image-wrap">
                <ProductImage src={item.imageUrl} name={item.name} />
              </div>
              <h2>{item.name}</h2>
              <p>Mã món #{item.id}</p>
              <p>
                {money(item.price)} · {item.isActive ? "Đang bán" : "Ngừng bán"}
              </p>
              <p>
                {
                  categories.find(
                    (category) => category.value === item.category,
                  )?.label
                }
              </p>
              <details>
                <summary>Nguyên liệu size M</summary>
                <ul>
                  {item.ingredients.map((row) => (
                    <li key={row.ingredientId}>
                      {row.name}: {row.quantity} {row.unit}
                    </li>
                  ))}
                </ul>
              </details>
              <button
                disabled={!ingredients.data?.length}
                onClick={() => {
                  setSuccess("");
                  setClone(false);
                  setEdit(item);
                }}
              >
                Sửa
              </button>
              <button
                disabled={!ingredients.data?.length}
                onClick={() => {
                  setSuccess("");
                  setClone(true);
                  setEdit(item);
                }}
              >
                Sao chép
              </button>
              <button disabled={busyId !== null} onClick={() => toggle(item)}>
                {busyId === item.id
                  ? "Đang cập nhật…"
                  : item.isActive
                    ? "Ngừng bán"
                    : "Mở bán"}
              </button>
            </section>
          ))}
      </div>
    </>
  );
}
