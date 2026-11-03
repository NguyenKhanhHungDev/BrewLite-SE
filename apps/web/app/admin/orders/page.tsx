"use client";
import { useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import OrderCard from "@/components/OrderCard";
import { useAdminList } from "@/components/admin/useAdminList";
import {
  parseAdminOrders,
  parseAdminOrder,
  paymentName,
  type AdminOrder,
} from "@/lib/admin-orders";
import { money } from "@/lib/pricing";
import { statusNames } from "@/lib/orders";
export default function Page() {
  const [page, setPage] = useState(1),
    [limit, setLimit] = useState(20);
  const list = useAdminList(
    `/api/admin/orders?page=${page}&limit=${limit}`,
    parseAdminOrders,
  );
  const { request } = useAuth();
  const [detailError, setDetailError] = useState(""),
    [detailBusy, setDetailBusy] = useState(false);
  const detailVersion = useRef(0);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  async function open(id: number) {
    const version = ++detailVersion.current;
    setDetailBusy(true);
    setDetailError("");
    setSelected(null);
    try {
      const data = parseAdminOrder(await request(`/api/admin/orders/${id}`));
      if (version === detailVersion.current) setSelected(data);
    } catch (cause) {
      if (version === detailVersion.current)
        setDetailError(
          cause instanceof Error
            ? cause.message
            : "Không tải được chi tiết đơn.",
        );
    } finally {
      if (version === detailVersion.current) setDetailBusy(false);
    }
  }
  return (
    <>
      <h1>Đơn hàng</h1>
      <label>
        Số đơn mỗi trang{" "}
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
      {list.loading && <p role="status">Đang tải đơn hàng…</p>}
      {list.error && (
        <p role="alert">
          {list.error} <button onClick={list.reload}>Thử lại</button>
        </p>
      )}
      {list.data?.data.length === 0 && <p>Chưa có đơn hàng</p>}
      {list.data && (
        <p>
          Tổng {list.data.total} đơn · Trang {list.data.page}/
          {Math.max(1, list.data.totalPages)}
        </p>
      )}
      {!!list.data?.data.length && (
        <div className="bl-admin-table">
          <table>
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Tổng tiền</th>
                <th>Trạng thái đơn</th>
                <th>Thanh toán</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((order) => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>{money(order.total)}</td>
                  <td>{statusNames[order.status]}</td>
                  <td>{paymentName(order.paymentStatus)}</td>
                  <td>
                    <button
                      disabled={detailBusy}
                      onClick={() => void open(order.id)}
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
      <div className="bl-actions">
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
      {detailBusy && <p role="status">Đang tải chi tiết…</p>}
      {detailError && <p role="alert">{detailError}</p>}
      {selected && (
        <section className="bl-panel">
          <p>Khách hàng: {selected.userEmail}</p>
          <p>Thanh toán: {paymentName(selected.paymentStatus)}</p>
          {selected.expiresAt && (
            <p>
              Hạn thanh toán:{" "}
              {new Date(selected.expiresAt).toLocaleString("vi-VN")}
            </p>
          )}
          <OrderCard order={selected} />
          <button
            onClick={() => {
              ++detailVersion.current;
              setSelected(null);
            }}
          >
            Đóng
          </button>
        </section>
      )}
    </>
  );
}
