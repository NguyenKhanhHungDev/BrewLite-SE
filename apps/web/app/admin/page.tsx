"use client";
import Link from "next/link";
import { useAdminList } from "@/components/admin/useAdminList";
import { parseIngredients } from "@/lib/ingredients";
import { parseRecipes } from "@/lib/recipes";
import { parseAdminOrders } from "@/lib/admin-orders";
export default function Page() {
  const ingredients = useAdminList("/ingredients", parseIngredients),
    recipes = useAdminList("/recipes", parseRecipes),
    orders = useAdminList("/api/admin/orders?limit=1", parseAdminOrders);
  const lowStock = ingredients.data?.filter((item) => item.available <= item.minStock);
  const stats = [
    { label: "Nguyên liệu", value: ingredients.data?.length, href: "/admin/ingredients", note: "Theo dõi tồn kho" },
    { label: "Công thức & món", value: recipes.data?.length, href: "/admin/recipes", note: "Quản lý thực đơn" },
    { label: "Đơn hàng", value: orders.data?.total, href: "/admin/orders", note: "Tất cả đơn hàng" },
    { label: "Nguyên liệu sắp hết", value: lowStock?.length, href: "/admin/ingredients", note: "Khả dụng ≤ ngưỡng tồn" },
  ];
  return (
    <>
      <h1>Tổng quan cửa hàng</h1>
      <p className="bl-admin-intro">Kiểm tra nguyên liệu, thực đơn và đơn hàng trong một không gian.</p>
      <div className="bl-admin-cards">
        {stats.map(({ label, value, href, note }) => (
          <Link className="bl-panel bl-admin-stat" href={href} key={label}>
            <h2>{label}</h2><strong>{value ?? "—"}</strong><small>{note} →</small>
          </Link>
        ))}
      </div>
      {ingredients.loading || recipes.loading || orders.loading ? <p role="status">Đang tải tổng quan…</p> : null}
      {[ingredients, recipes, orders].map((list, index) => list.error && (
        <p key={index} role="alert">{list.error} <button onClick={list.reload}>Thử lại</button></p>
      ))}
      <div className="bl-admin-overview-grid">
        <section className="bl-panel">
          <div className="bl-admin-section-heading"><h2>Nguyên liệu cần chú ý</h2><Link href="/admin/ingredients">Xem kho →</Link></div>
          {lowStock?.length === 0 && <p>Không có nguyên liệu dưới hoặc bằng ngưỡng tồn.</p>}
          {!lowStock && <p>{ingredients.error ? "Chưa tải được thông tin tồn kho." : "Đang tải tồn kho…"}</p>}
          <ul className="bl-admin-stock-list">
            {lowStock?.slice(0, 5).map((item) => <li key={item.id}><div>{item.name}<small>Ngưỡng tồn: {item.minStock} {item.unit}</small></div><strong>{item.available} {item.unit}</strong></li>)}
          </ul>
          {!!lowStock && lowStock.length > 5 && <p>Còn {lowStock.length - 5} nguyên liệu cần chú ý trong kho.</p>}
        </section>
        <section className="bl-panel">
          <div className="bl-admin-section-heading"><h2>Công việc quản trị</h2></div>
          <div className="bl-admin-shortcuts">
            <Link href="/admin/orders">Xử lý đơn hàng →<small>Xem chi tiết và cập nhật tiến độ pha chế.</small></Link>
            <Link href="/admin/recipes">Quản lý công thức →<small>Điều chỉnh món, giá bán và định lượng.</small></Link>
            <Link href="/admin/payments">Kiểm tra đối soát →<small>Xem giao dịch cần kiểm tra thanh toán.</small></Link>
          </div>
        </section>
      </div>
    </>
  );
}
