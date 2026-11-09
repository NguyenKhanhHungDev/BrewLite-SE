"use client";
import { inventoryStatus } from "@/lib/inventory-admin";
import { statusLabels, topping } from "./ingredients-config";
import type { IngredientsModel } from "./useAdminIngredients";
export default function IngredientTable({
  model,
}: {
  model: IngredientsModel;
}) {
  const {
    list,
    setPage,
    limit,
    setLimit,
    all,
    rows,
    totalPages,
    page,
    visible,
    open,
  } = model;
  return (
    <>
      {!!rows.length && (
        <>
          <p role="status">
            {rows.length} / {all.length} nguyên liệu · Đang xem{" "}
            {(page - 1) * limit + 1}–{Math.min(page * limit, rows.length)}
          </p>
          <div className="bl-admin-table">
            <table>
              <thead>
                <tr>
                  {[
                    "ID / Tên",
                    "Đơn vị",
                    "Tồn thực",
                    "Đang giữ",
                    "Khả dụng",
                    "Ngưỡng tồn",
                    "Tình trạng",
                    "Thao tác",
                  ].map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <small>#{item.id}</small>
                      <br />
                      <strong>{item.name}</strong>
                      {topping(item) && <small> · Topping hệ thống</small>}
                    </td>
                    <td>{item.unit}</td>
                    <td>{item.stock}</td>
                    <td>{item.reserved}</td>
                    <td>{item.available}</td>
                    <td>{item.minStock}</td>
                    <td>
                      <span
                        className={`bl-admin-stock-${inventoryStatus(item)}`}
                      >
                        {statusLabels[inventoryStatus(item)]}
                      </span>
                    </td>
                    <td>
                      <div className="bl-actions">
                        <button
                          disabled={list.loading}
                          onClick={() => open("edit", item)}
                          aria-label={`Sửa ${item.name}`}
                        >
                          Sửa
                        </button>
                        <button
                          disabled={list.loading}
                          onClick={() => open("restock", item)}
                          aria-label={`Nhập kho ${item.name}`}
                        >
                          Nhập kho
                        </button>
                        <button
                          disabled={list.loading || item.version === undefined}
                          title={
                            item.version === undefined
                              ? "Cần API hỗ trợ phiên bản tồn kho"
                              : undefined
                          }
                          onClick={() => open("adjust", item)}
                          aria-label={`Kiểm kho ${item.name}`}
                        >
                          Kiểm kho
                        </button>
                        <button
                          onClick={() => open("history", item)}
                          aria-label={`Lịch sử ${item.name}`}
                        >
                          Lịch sử
                        </button>
                        <button
                          className="bl-admin-danger"
                          disabled={list.loading || topping(item)}
                          onClick={() => open("delete", item)}
                          aria-label={`Xóa ${item.name}`}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="bl-admin-pagination"
            aria-label="Phân trang nguyên liệu"
          >
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Trang trước
            </button>
            <span>
              Trang {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Trang sau
            </button>
            <label>
              Mỗi trang
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
    </>
  );
}
