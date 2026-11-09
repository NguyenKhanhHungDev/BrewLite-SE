"use client";
import OrderCard from "@/components/OrderCard";
import AdminOrderDialog from "./AdminOrderDialog";
import { paymentName } from "@/lib/admin-orders";
import Link from "next/link";
import { nextProgress } from "./orders-config";
import type { OrdersModel } from "./useAdminOrders";
export default function OrderDetails({ model }: { model: OrdersModel }) {
  const {
    cancelReason,
    setCancelReason,
    cancelBusy,
    detailError,
    detailBusy,
    selected,
    progressBusyId,
    progressError,
    progressMessage,
    open,
    closeDetail,
    cancelOrder,
    advanceProgress,
  } = model;
  return (
    <>
      {(detailBusy || detailError || selected) && (
        <AdminOrderDialog onClose={closeDetail}>
          {progressError && (
            <p className="bl-alert bl-alert-error" role="alert">
              {progressError}
            </p>
          )}
          {progressMessage && (
            <p className="bl-alert" role="status">
              {progressMessage}
            </p>
          )}
          {detailBusy && <p role="status">Đang tải chi tiết…</p>}
          {detailError && (
            <p role="alert">
              {detailError}{" "}
              <button
                onClick={() => {
                  const id = Number(
                    new URLSearchParams(window.location.search).get("id"),
                  );
                  if (id > 0) void open(id);
                }}
              >
                Thử lại chi tiết
              </button>
            </p>
          )}
          {selected && (
            <section className="bl-panel">
              <p>Khách hàng: {selected.userEmail}</p>
              <p>
                Người nhận: {selected.recipientName ?? "Đơn cũ chưa có dữ liệu"}
              </p>
              <p>Số điện thoại người nhận: {selected.recipientPhone ?? "—"}</p>
              <p>Thanh toán: {paymentName(selected.paymentStatus)}</p>
              {selected.expiresAt && (
                <p>
                  Hạn thanh toán:{" "}
                  {new Date(selected.expiresAt).toLocaleString("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                  })}
                </p>
              )}
              <OrderCard order={selected} adminView />
              <Link href="/admin/payments">Mở trang đối soát</Link>
              {selected.cancellationReason && (
                <p>
                  Lý do hủy: {selected.cancellationReason} ·{" "}
                  {selected.cancelledAt
                    ? new Date(selected.cancelledAt).toLocaleString("vi-VN", {
                        timeZone: "Asia/Ho_Chi_Minh",
                      })
                    : ""}{" "}
                  · Quản trị viên #{selected.cancelledById}
                </p>
              )}
              {(["PENDING", "PAYMENT_FAILED"] as string[]).includes(
                selected.status,
              ) && (
                <form onSubmit={cancelOrder} className="bl-admin-form">
                  <p>
                    Chỉ hủy khi không có giao dịch thành công, chưa rõ kết quả
                    hoặc cần đối soát.
                  </p>
                  <label>
                    Lý do hủy đơn
                    <textarea
                      required
                      maxLength={300}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                  </label>
                  <button
                    className="bl-admin-danger"
                    disabled={cancelBusy || !cancelReason.trim()}
                  >
                    {cancelBusy ? "Đang hủy…" : "Hủy đơn"}
                  </button>
                </form>
              )}
              {nextProgress(selected.status) && (
                <button
                  className="bl-button"
                  disabled={progressBusyId !== null}
                  onClick={() => void advanceProgress(selected)}
                >
                  {progressBusyId === selected.id
                    ? "Đang cập nhật…"
                    : nextProgress(selected.status)?.label}
                </button>
              )}
              <button onClick={closeDetail}>Đóng</button>
            </section>
          )}
        </AdminOrderDialog>
      )}
    </>
  );
}
