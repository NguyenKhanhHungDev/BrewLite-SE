"use client";
import { downloadCsv } from "@/lib/admin-tools";
import { categories } from "@/lib/menu";
import type { RecipesModel } from "./useAdminRecipes";
export default function RecipeFilters({ model }: { model: RecipesModel }) {
  const {
    list,
    query,
    setQuery,
    filter,
    setFilter,
    categoryFilter,
    setCategoryFilter,
    sort,
    setSort,
    setPage,
    filtered,
  } = model;
  return (
    <>
      <div className="bl-panel bl-admin-toolbar">
        <label>
          Tìm món
          <input
            value={query}
            placeholder="Tên hoặc mã món"
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Danh mục
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trạng thái
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang bán</option>
            <option value="INACTIVE">Ngừng bán</option>
          </select>
        </label>
        <label>
          Sắp xếp
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="name">Tên A–Z</option>
            <option value="price">Giá tăng dần</option>
            <option value="id">Mới nhất</option>
          </select>
        </label>
        <button
          disabled={!filtered.length}
          onClick={() =>
            downloadCsv(
              "cong-thuc.csv",
              [
                "Mã",
                "Tên món",
                "Giá M",
                "Danh mục",
                "Trạng thái",
                "Định lượng M",
              ],
              filtered.map((i) => [
                i.id,
                i.name,
                i.price,
                categories.find((c) => c.value === i.category)?.label,
                i.isActive ? "Đang bán" : "Ngừng bán",
                i.ingredients
                  .map((r) => `${r.name}: ${r.quantity} ${r.unit}`)
                  .join("; "),
              ]),
            )
          }
        >
          Xuất CSV kết quả lọc
        </button>
        <button
          onClick={() => {
            setQuery("");
            setFilter("ALL");
            setCategoryFilter("ALL");
            setSort("name");
            setPage(1);
          }}
        >
          Xóa bộ lọc
        </button>
        <button disabled={list.loading} onClick={list.reload}>
          Tải lại
        </button>
      </div>
    </>
  );
}
