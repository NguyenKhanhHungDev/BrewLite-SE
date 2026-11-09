"use client";
import { PaymentRows } from "@/components/PaymentDetails";
import { paymentName } from "@/lib/admin-orders";
import { statusNames, type OrderStatus } from "@/lib/orders";
import { money } from "@/lib/pricing";
import Link from "next/link";
import { vietnamTime } from "./payments-config";
import type { PaymentsModel } from "./useAdminPayments";
export default function PaymentDetailsPanel({
  model,
}: {
  model: PaymentsModel;
}) {
  const {
    selected,
    note,
    setNote,
    busy,
    open,
    saveNote,
    recheck,
    closeDetail,
  } = model;
  return (
    <>
      {selected && (
        <section className="bl-panel bl-admin-detail">
          <h2>Giao dịch #{selected.id}</h2>
          <Link href={`/admin/orders?id=${selected.orderId}`}>
            Xem đơn #{selected.orderId}
          </Link>
          <p>
            Đơn:{" "}
            {statusNames[selected.order.status as OrderStatus] ??
              selected.order.status}{" "}
            · {money(selected.order.total)}
          </p>
          <p>
            Khách: {selected.order.user.name ?? "—"} ·{" "}
            {selected.order.user.email}
          </p>
          <p>
            Người nhận: {selected.order.recipientName ?? "—"} ·{" "}
            {selected.order.recipientPhone ?? "—"}
          </p>
          <p>
            Thanh toán: {paymentName(selected.status)} · Khởi tạo:{" "}
            {selected.creationStatus}
          </p>
          <form className="bl-admin-form" onSubmit={saveNote}>
            <label>
              Ghi chú quản trị
              <textarea
                maxLength={1000}
                value={note}
                disabled={busy}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <p>{note.length}/1000 ký tự</p>
            <button disabled={busy}>Lưu ghi chú</button>
          </form>
          {selected.adminNoteUpdatedAt && (
            <p>
              Cập nhật ghi chú: {vietnamTime(selected.adminNoteUpdatedAt)} ·{" "}
              {selected.adminNoteUpdatedBy?.email ??
                `Quản trị viên #${selected.adminNoteUpdatedById}`}
            </p>
          )}
          <div className="bl-actions">
            <button
              disabled={
                busy ||
                selected.provider !== "ZALOPAY" ||
                !selected.transactionRef
              }
              onClick={() => void recheck()}
            >
              {busy ? "Đang xử lý…" : "Kiểm tra lại ZaloPay"}
            </button>
            <button disabled={busy} onClick={() => void open(selected.id)}>
              Tải lại chi tiết
            </button>
            <button disabled={busy} onClick={closeDetail}>
              Đóng chi tiết
            </button>
          </div>
          <h3>Lịch sử thanh toán của đơn</h3>
          <PaymentRows payments={selected.order.payments ?? []} />
        </section>
      )}
    </>
  );
}
