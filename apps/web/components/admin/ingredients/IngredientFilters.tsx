"use client";
import { downloadCsv } from "@/lib/admin-tools";
import { inventoryStatus, type InventoryFilters } from "@/lib/inventory-admin";
import { initialFilters, statusLabels } from "./ingredients-config";
import type { IngredientsModel } from "./useAdminIngredients";
export default function IngredientFilters({
  model,
}: {
  model: IngredientsModel;
}) {
  const { list, filters, setFilters, setPage, rows, filter } = model;
  return (
    <>
      <div className="bl-panel bl-admin-toolbar">
        <label>
          Tìm tên hoặc ID
          <input
            type="search"
            value={filters.query}
            placeholder="Ví dụ: cà phê, 12"
            onChange={(e) => filter({ query: e.target.value })}
          />
        </label>
        <label>
          Đơn vị
          <select
            value={filters.unit}
            onChange={(e) =>
              filter({ unit: e.target.value as InventoryFilters["unit"] })
            }
          >
            <option value="all">Tất cả đơn vị</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
          </select>
        </label>
        <label>
          Tồn kho
          <select
            value={filters.status}
            onChange={(e) =>
              filter({ status: e.target.value as InventoryFilters["status"] })
            }
          >
            <option value="all">Tất cả tình trạng</option>
            <option value="low">Chạm ngưỡng / sắp hết</option>
            <option value="empty">Hết khả dụng</option>
            <option value="ok">Còn hàng</option>
          </select>
        </label>
        <label>
          Sắp xếp
          <select
            value={filters.sort}
            onChange={(e) =>
              filter({ sort: e.target.value as InventoryFilters["sort"] })
            }
          >
            <option value="name">Tên A–Z</option>
            <option value="id">ID tăng dần</option>
            <option value="available-asc">Khả dụng tăng dần</option>
            <option value="available-desc">Khả dụng giảm dần</option>
          </select>
        </label>
        <button
          disabled={!rows.length || list.loading || !!list.error}
          onClick={() =>
            downloadCsv(
              "nguyen-lieu.csv",
              [
                "ID",
                "Tên",
                "Đơn vị",
                "Tồn thực",
                "Đang giữ",
                "Khả dụng",
                "Ngưỡng tồn",
                "Tình trạng",
              ],
              rows.map((r) => [
                r.id,
                r.name,
                r.unit,
                r.stock,
                r.reserved,
                r.available,
                r.minStock,
                statusLabels[inventoryStatus(r)],
              ]),
            )
          }
        >
          Xuất CSV (kết quả lọc)
        </button>
        <button
          onClick={() => {
            setFilters(initialFilters);
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
