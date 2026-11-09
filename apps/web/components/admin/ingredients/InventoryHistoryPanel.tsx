"use client";
import { useAdminList } from "@/components/admin/useAdminList";
import { parseInventoryHistory, type Ingredient } from "@/lib/ingredients";
import { useState } from "react";
export default function InventoryHistoryPanel({
  item,
  close,
}: {
  item: Ingredient;
  close: () => void;
}) {
  const [page, setPage] = useState(1);
  const list = useAdminList(
    `/ingredients/${item.id}/movements?page=${page}`,
    parseInventoryHistory,
  );
  const history = list.data;
  return (
    <section
      className="bl-panel bl-admin-detail"
      aria-label={`Lịch sử kho ${item.name}`}
    >
      <div className="bl-admin-title">
        <h2>Lịch sử kho: {item.name}</h2>
        <button onClick={close}>Đóng lịch sử</button>
      </div>
      <p>
        Lịch sử nhập và kiểm kho thủ công. Các lượng giữ/tiêu hao theo đơn hàng
        được quản lý trong đơn.
      </p>
      {list.loading && <p role="status">Đang tải lịch sử…</p>}
      {list.error && (
        <p role="alert">
          {list.error} <button onClick={list.reload}>Thử lại</button>
        </p>
      )}
      {history && (
        <>
          <p>{history.total} lần thao tác</p>
          {!history.data.length ? (
            <p>Chưa có lịch sử nhập hoặc kiểm kho trên trang này.</p>
          ) : (
            <div className="bl-admin-table">
              <table>
                <thead>
                  <tr>
                    {[
                      "Thời gian (Việt Nam)",
                      "Người thao tác",
                      "Loại",
                      "Trước → Sau",
                      "Thay đổi",
                      "Lý do",
                    ].map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.data.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {new Date(row.createdAt).toLocaleString("vi-VN", {
                          timeZone: "Asia/Ho_Chi_Minh",
                        })}
                      </td>
                      <td>
                        {row.actor.name || row.actor.email}
                        <br />
                        <small>
                          #{row.actor.id}
                          {row.actor.name ? ` · ${row.actor.email}` : ""}
                        </small>
                      </td>
                      <td>
                        {row.kind === "RESTOCK" ? "Nhập kho" : "Kiểm kho"}
                      </td>
                      <td>
                        {row.stockBefore} → {row.stockAfter} {item.unit}
                      </td>
                      <td>
                        {row.delta > 0 ? "+" : ""}
                        {row.delta}
                      </td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="bl-admin-pagination">
            <button
              disabled={page <= 1 || list.loading}
              onClick={() => setPage(page - 1)}
            >
              Lịch sử trước
            </button>
            <span>
              Trang {history.page} / {history.totalPages}
            </span>
            <button
              disabled={page >= history.totalPages || list.loading}
              onClick={() => setPage(page + 1)}
            >
              Lịch sử sau
            </button>
            <button disabled={list.loading} onClick={list.reload}>
              Tải lại lịch sử
            </button>
          </div>
        </>
      )}
    </section>
  );
}
