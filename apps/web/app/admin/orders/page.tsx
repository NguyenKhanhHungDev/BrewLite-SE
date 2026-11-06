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
import { statusNames, type OrderStatus } from "@/lib/orders";

const statusOptions: Array<{ value: OrderStatus | ""; label: string }> = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: statusNames.PENDING },
  { value: "PAID", label: statusNames.PAID },
  { value: "PREPARING", label: statusNames.PREPARING },
  { value: "READY", label: statusNames.READY },
  { value: "COMPLETED", label: statusNames.COMPLETED },
  { value: "PAYMENT_FAILED", label: statusNames.PAYMENT_FAILED },
  { value: "CANCELLED", label: statusNames.CANCELLED },
];

function nextProgress(status: OrderStatus): { status: OrderStatus; label: string } | null {
  if (status === "PAID") return { status: "PREPARING", label: "Bắt đầu pha" };
  if (status === "PREPARING") return { status: "READY", label: "Sẵn sàng" };
  if (status === "READY") return { status: "COMPLETED", label: "Đã giao khách" };
  return null;
}

export default function Page() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [applied, setApplied] = useState({ dateFrom: "", dateTo: "", status: "" });
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (applied.dateFrom) query.set("dateFrom", applied.dateFrom);
  if (applied.dateTo) query.set("dateTo", applied.dateTo);
  if (applied.status) query.set("status", applied.status);
  const list = useAdminList(`/api/admin/orders?${query.toString()}`, parseAdminOrders);
  const { request } = useAuth();
  const [detailError, setDetailError] = useState("");
  const [detailBusy, setDetailBusy] = useState(false);
  const detailVersion = useRef(0);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [progressBusyId, setProgressBusyId] = useState<number | null>(null);
  const [progressError, setProgressError] = useState("");
  const [progressMessage, setProgressMessage] = useState("");

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
        setDetailError(cause instanceof Error ? cause.message : "Không tải được chi tiết đơn.");
    } finally {
      if (version === detailVersion.current) setDetailBusy(false);
    }
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setProgressError("Ngày bắt đầu không được sau ngày kết thúc.");
      return;
    }
    setProgressError("");
    setPage(1);
    setApplied({ dateFrom, dateTo, status });
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setStatus("");
    setApplied({ dateFrom: "", dateTo: "", status: "" });
    setProgressError("");
    setPage(1);
  }

  async function advanceProgress(order: AdminOrder) {
    const next = nextProgress(order.status);
    if (!next || progressBusyId !== null) return;
    setProgressBusyId(order.id);
    setProgressError("");
    setProgressMessage("");
    try {
      await request(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next.status }),
      });
      setProgressMessage(`Đơn #${order.id}: ${statusNames[next.status]}.`);
      list.reload();
      if (selected?.id === order.id) await open(order.id);
    } catch (cause) {
      setProgressError(cause instanceof Error ? cause.message : "Không cập nhật được tiến độ đơn.");
      list.reload();
    } finally {
      setProgressBusyId(null);
    }
  }

  return (
    <>
      <h1>Đơn hàng</h1>
      <form className="bl-admin-form bl-order-filters" onSubmit={applyFilters}>
        <fieldset>
          <legend>Lọc đơn hàng</legend>
          <div className="bl-order-filter-grid">
            <label>
              Từ ngày (giờ Việt Nam)
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label>
              Đến ngày (giờ Việt Nam)
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} />
            </label>
            <label>
              Trạng thái đơn
              <select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus | "")}>
                {statusOptions.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <div className="bl-actions">
            <button className="bl-button" type="submit">Áp dụng bộ lọc</button>
            <button className="bl-button bl-button-secondary" type="button" onClick={clearFilters}>Xóa bộ lọc</button>
          </div>
        </fieldset>
      </form>
      <label>
        Số đơn mỗi trang{" "}
        <select value={limit} onChange={(event) => { setPage(1); setLimit(Number(event.target.value)); }}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </label>
      {progressError && <p className="bl-alert bl-alert-error" role="alert">{progressError}</p>}
      {progressMessage && <p className="bl-alert" role="status">{progressMessage}</p>}
      {list.loading && <p role="status">Đang tải đơn hàng…</p>}
      {list.error && <p role="alert">{list.error} <button onClick={list.reload}>Thử lại</button></p>}
      {list.data?.data.length === 0 && <p>Không có đơn hàng phù hợp bộ lọc.</p>}
      {list.data && <p>Tổng {list.data.total} đơn · Trang {list.data.page}/{Math.max(1, list.data.totalPages)}</p>}
      {!!list.data?.data.length && (
        <div className="bl-admin-table">
          <table>
            <thead><tr><th>Mã đơn</th><th>Tổng tiền</th><th>Trạng thái đơn</th><th>Thanh toán</th><th>Tiến độ pha chế</th><th>Chi tiết</th></tr></thead>
            <tbody>
              {list.data.data.map((order) => {
                const next = nextProgress(order.status);
                return (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{money(order.total)}</td>
                    <td>{statusNames[order.status]}</td>
                    <td>{paymentName(order.paymentStatus)}</td>
                    <td>
                      {next ? (
                        <button disabled={progressBusyId !== null} onClick={() => void advanceProgress(order)}>
                          {progressBusyId === order.id ? "Đang cập nhật…" : next.label}
                        </button>
                      ) : order.status === "PENDING" ? "Chờ thanh toán" : "—"}
                    </td>
                    <td><button disabled={detailBusy} onClick={() => void open(order.id)}>Xem</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="bl-actions">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</button>
        <button disabled={!list.data || page >= list.data.totalPages} onClick={() => setPage(page + 1)}>Trang sau</button>
        <button onClick={list.reload}>Tải lại</button>
      </div>
      {detailBusy && <p role="status">Đang tải chi tiết…</p>}
      {detailError && <p role="alert">{detailError}</p>}
      {selected && (
        <section className="bl-panel">
          <p>Khách hàng: {selected.userEmail}</p>
          <p>Người nhận: {selected.recipientName ?? "Đơn cũ chưa có dữ liệu"}</p>
          <p>Số điện thoại người nhận: {selected.recipientPhone ?? "—"}</p>
          <p>Thanh toán: {paymentName(selected.paymentStatus)}</p>
          {selected.expiresAt && <p>Hạn thanh toán: {new Date(selected.expiresAt).toLocaleString("vi-VN")}</p>}
          <OrderCard order={selected} />
          {nextProgress(selected.status) && (
            <button className="bl-button" disabled={progressBusyId !== null} onClick={() => void advanceProgress(selected)}>
              {progressBusyId === selected.id ? "Đang cập nhật…" : nextProgress(selected.status)?.label}
            </button>
          )}
          <button onClick={() => { ++detailVersion.current; setSelected(null); }}>Đóng</button>
        </section>
      )}
    </>
  );
}
