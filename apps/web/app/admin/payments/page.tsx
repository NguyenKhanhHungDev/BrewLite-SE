"use client";

import { useState } from "react";
import { useAdminList } from "@/components/admin/useAdminList";
import {
  parseAdminReconciliationPage,
  type AdminReconciliationRecord,
} from "@/lib/admin-payments";
import { statusNames } from "@/lib/orders";
import { money } from "@/lib/pricing";

export default function AdminReconciliationPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selected, setSelected] = useState<AdminReconciliationRecord | null>(null);

  const list = useAdminList(
    `/api/admin/payments/reconciliation?page=${page}&limit=${limit}`,
    parseAdminReconciliationPage,
  );

  return (
    <>
      <h1>Giao dịch cần đối soát</h1>

      <p className="bl-alert bl-alert-warning" role="note" style={{ margin: "1rem 0" }}>
        <strong>Lưu ý nghiệp vụ:</strong> Đây là các giao dịch gặp trạng thái bất thường hoặc chưa có kết quả cuối cùng từ cổng thanh toán ZaloPay (<code>RECONCILIATION_REQUIRED</code>). Nhân viên đối soát cần kiểm tra mã giao dịch trực tiếp trên hệ thống cổng thanh toán trước khi quyết định. Không xem giao dịch cần đối soát là thanh toán thất bại chắc chắn.
      </p>

      <label>
        Số giao dịch mỗi trang{" "}
        <select
          value={limit}
          onChange={(e) => {
            setPage(1);
            setLimit(Number(e.target.value));
          }}
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </label>

      {list.loading && <p role="status">Đang tải danh sách đối soát…</p>}
      {list.error && (
        <p role="alert">
          {list.error} <button onClick={list.reload}>Thử lại</button>
        </p>
      )}

      {list.data?.data.length === 0 && (
        <p className="bl-muted" style={{ padding: "1.5rem 0" }}>
          ✅ Hiện không có giao dịch nào cần đối soát.
        </p>
      )}

      {list.data && list.data.data.length > 0 && (
        <p>
          Tổng {list.data.total} giao dịch cần đối soát · Trang {list.data.page}/
          {Math.max(1, list.data.totalPages)}
        </p>
      )}

      {!!list.data?.data.length && (
        <div className="bl-admin-table">
          <table>
            <thead>
              <tr>
                <th>Mã GD</th>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Số tiền</th>
                <th>TT Thanh toán</th>
                <th>TT Đơn hàng</th>
                <th>Mã tham chiếu</th>
                <th>Thời gian</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((item) => (
                <tr key={item.paymentId}>
                  <td>#{item.paymentId}</td>
                  <td>#{item.orderId}</td>
                  <td>{item.userEmail || "Khách"}</td>
                  <td>{money(item.amount)}</td>
                  <td>
                    <span className="bl-status bl-status-warning">
                      Cần đối soát
                    </span>
                  </td>
                  <td>
                    <span className="bl-status">
                      {statusNames[item.orderStatus as keyof typeof statusNames] ?? item.orderStatus}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>
                    <code>{item.transactionRef ?? "—"}</code>
                  </td>
                  <td>{new Date(item.createdAt).toLocaleString("vi-VN")}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                    >
                      Xem
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.data && list.data.totalPages > 1 && (
        <div className="bl-actions" style={{ marginTop: "1rem" }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Trang trước
          </button>
          <button
            disabled={!list.data || page >= list.data.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Trang sau
          </button>
          <button onClick={list.reload}>Tải lại</button>
        </div>
      )}

      {selected && (
        <section
          className="bl-panel"
          style={{
            marginTop: "1.5rem",
            border: "2px solid #eab308",
            backgroundColor: "#fefce8",
          }}
        >
          <h2>Chi tiết đối soát giao dịch #{selected.paymentId}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", margin: "1rem 0" }}>
            <p><strong>Mã đơn hàng:</strong> #{selected.orderId}</p>
            <p><strong>Khách hàng:</strong> {selected.userEmail || "—"}</p>
            <p><strong>Số tiền:</strong> {money(selected.amount)}</p>
            <p><strong>Phương thức:</strong> {selected.method} ({selected.provider})</p>
            <p>
              <strong>Trạng thái thanh toán:</strong>{" "}
              <span className="bl-status bl-status-warning">Cần đối soát (RECONCILIATION_REQUIRED)</span>
            </p>
            <p>
              <strong>Trạng thái đơn hàng:</strong>{" "}
              <span className="bl-status">
                {statusNames[selected.orderStatus as keyof typeof statusNames] ?? selected.orderStatus}
              </span>
            </p>
            <p><strong>Mã tham chiếu (app_trans_id):</strong> <code>{selected.transactionRef ?? "—"}</code></p>
            <p><strong>Mã ZaloPay (zp_trans_id):</strong> <code>{selected.providerTransactionId ?? "Chưa có"}</code></p>
            <p><strong>Thời gian tạo:</strong> {new Date(selected.createdAt).toLocaleString("vi-VN")}</p>
            <p>
              <strong>Lần tra cứu gần nhất:</strong>{" "}
              {selected.lastQueriedAt ? new Date(selected.lastQueriedAt).toLocaleString("vi-VN") : "Chưa tra cứu"}
            </p>
          </div>

          <p className="bl-muted" style={{ fontSize: "0.85rem" }}>
            * Chức năng này phục vụ tra cứu thông tin đối soát an toàn. Quyết định cập nhật đơn hàng tuân thủ quy tắc của quán và kết quả tra soát ngân hàng/ZaloPay.
          </p>

          <button
            className="bl-button bl-button-secondary"
            type="button"
            onClick={() => setSelected(null)}
            style={{ marginTop: "0.75rem" }}
          >
            Đóng chi tiết
          </button>
        </section>
      )}
    </>
  );
}
