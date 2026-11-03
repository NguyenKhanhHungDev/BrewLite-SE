"use client";
import { useAdminList } from "@/components/admin/useAdminList";
import { parseIngredients } from "@/lib/ingredients";
import { parseRecipes } from "@/lib/recipes";
import { parseAdminOrders } from "@/lib/admin-orders";
export default function Page() {
  const ingredients = useAdminList("/ingredients", parseIngredients),
    recipes = useAdminList("/recipes", parseRecipes),
    orders = useAdminList("/api/admin/orders", parseAdminOrders);
  return (
    <>
      <h1>Tổng quan</h1>
      <div className="bl-admin-cards">
        {[
          ["Nguyên liệu", ingredients.data?.length],
          ["Công thức", recipes.data?.length],
          ["Đơn hàng", orders.data?.total],
          [
            "Nguyên liệu sắp hết",
            ingredients.data?.filter((i) => i.available <= i.minStock).length,
          ],
        ].map(([label, value]) => (
          <section className="bl-panel" key={label}>
            <h2>{label}</h2>
            <strong>{value ?? "—"}</strong>
          </section>
        ))}
      </div>
      {ingredients.loading || recipes.loading || orders.loading ? (
        <p role="status">Đang tải tổng quan…</p>
      ) : null}
      {[ingredients, recipes, orders].map(
        (list, index) =>
          list.error && (
            <p key={index} role="alert">
              {list.error} <button onClick={list.reload}>Thử lại</button>
            </p>
          ),
      )}
    </>
  );
}
