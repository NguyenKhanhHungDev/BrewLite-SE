"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { useCheckout } from "./CheckoutProvider";
import OrderCard from "./OrderCard";
import LoyaltyBalance from "./LoyaltyBalance";
import { parseHistory, paidStatuses, type OrderRecord, type OrderStatus } from "@/lib/orders";
import { ApiError } from "@/lib/api";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; orders: OrderRecord[] };

const terminalStatuses: OrderStatus[] = ["COMPLETED", "CANCELLED", "PAYMENT_FAILED"];

export default function OrdersView({ orderId }: { orderId?: string }) {
  const auth = useAuth();
  return (
    <main className="bl-flow-wrap">
      <Link href="/" className="bl-detail-back">← Về Menu</Link>
      <div className="bl-page-title">
        <p className="bl-eyebrow">Đơn hàng của bạn</p>
        <h1>{orderId ? "Theo dõi đơn hàng" : "Lịch sử đơn hàng"}</h1>
      </div>
      {!auth.session ? (
        <section className="bl-panel bl-empty">
          <h2>{auth.expired ? "Phiên đăng nhập đã hết hạn" : "Vui lòng đăng nhập"}</h2>
          <p>Đăng nhập để xem đơn hàng của chính bạn.</p>
          <Link className="bl-button" href={`/login?next=${encodeURIComponent(orderId ? `/confirmation/${orderId}` : "/history")}`}>Đăng nhập</Link>
        </section>
      ) : (
        <OrdersData key={`${auth.session.userId}:${orderId ?? "history"}`} orderId={orderId} />
      )}
    </main>
  );
}

function OrdersData({ orderId }: { orderId?: string }) {
  const { request } = useAuth();
  const { syncOrder, purchase } = useCheckout();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [refreshWarning, setRefreshWarning] = useState("");
  const latestStatus = useRef<OrderStatus | null>(null);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let pollingStopped = false;

    async function load(initial: boolean) {
      if (inFlight || disposed) return;
      inFlight = true;
      if (initial) setState({ status: "loading" });
      try {
        const raw = orderId
          ? await request(`/orders/${encodeURIComponent(orderId)}`)
          : await request("/orders/me");
        const orders = parseHistory(orderId ? [raw] : raw);
        const selected = orderId === undefined
          ? orders
          : orders.filter((order) => String(order.id) === orderId);
        if (disposed) return;
        selected.forEach((order) => {
          latestStatus.current = order.status;
          syncOrder(order);
        });
        if (orderId && selected.length === 0) {
          setState({ status: "ready", orders: [] });
        } else {
          setState({ status: "ready", orders: selected });
        }
        setRefreshWarning("");
        if (selected[0] && terminalStatuses.includes(selected[0].status))
          pollingStopped = true;
      } catch (cause) {
        if (disposed) return;
        const message = cause instanceof Error ? cause.message : "Không tải được đơn hàng.";
        if (cause instanceof ApiError && [401, 403, 404].includes(cause.status))
          pollingStopped = true;
        if (initial) setState({ status: "error", message });
        else setRefreshWarning(`${message} Trạng thái đang hiển thị là lần cập nhật thành công gần nhất.`);
      } finally {
        inFlight = false;
      }
    }

    void load(true);
    const interval = orderId
      ? window.setInterval(() => {
          if (!pollingStopped && !terminalStatuses.includes(latestStatus.current ?? "PENDING"))
            void load(false);
        }, 5000)
      : null;

    return () => {
      disposed = true;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [request, orderId, attempt, syncOrder]);

  function refresh() {
    setRefreshWarning("");
    setAttempt((value) => value + 1);
  }

  if (state.status === "loading") return <p role="status">Đang tải dữ liệu đơn hàng...</p>;
  if (state.status === "error") {
    return (
      <section className="bl-panel">
        <p className="bl-alert bl-alert-error" role="alert">{state.message}</p>
        <button className="bl-button" onClick={refresh}>Thử lại</button>
      </section>
    );
  }
  if (!state.orders.length) {
    return (
      <section className="bl-panel bl-empty">
        <h2>{orderId ? "Không tìm thấy đơn hàng" : "Chưa có đơn hàng"}</h2>
        <p>{orderId ? "Đơn không tồn tại hoặc bạn không có quyền xem." : "Các đơn đã tạo sẽ xuất hiện tại đây."}</p>
        <Link href="/" className="bl-button">Xem Menu</Link>
      </section>
    );
  }

  const selected = state.orders[0];
  const progressMessage = selected.status === "READY"
    ? `Đơn #${selected.id} đã sẵn sàng. Bạn có thể đến quầy và cung cấp mã đơn #${selected.id} để nhận món.`
    : selected.status === "COMPLETED"
      ? `Đơn #${selected.id} đã được giao hoàn tất.`
      : selected.status === "CANCELLED"
        ? "Đơn hàng đã bị hủy."
        : selected.status === "PAYMENT_FAILED"
          ? "Thanh toán thất bại. Đơn không thể tiếp tục pha chế."
          : paidStatuses.includes(selected.status)
            ? "Thanh toán đã được xác nhận. Quán sẽ cập nhật tiến độ pha chế tại đây."
            : "Đơn đang chờ thanh toán. Chưa có xác nhận thanh toán thành công.";

  return (
    <>
      {orderId && <p className={`bl-alert${selected.status === "PAYMENT_FAILED" || selected.status === "CANCELLED" ? " bl-alert-error" : ""}`} role="status">{progressMessage}</p>}
      {orderId && !terminalStatuses.includes(selected.status) && (
        <p className="bl-muted">Trạng thái tự cập nhật khoảng mỗi 5 giây khi bạn ở trang này.</p>
      )}
      {refreshWarning && <p className="bl-alert bl-alert-error" role="status">{refreshWarning}</p>}
      <div className="bl-order-list">
        {state.orders.map((order) => (
          <div key={order.id}>
            <OrderCard order={order} />
            {!orderId && <Link href={`/confirmation/${order.id}`} className="bl-detail-back">Xem trạng thái đơn →</Link>}
          </div>
        ))}
      </div>
      {orderId && <LoyaltyBalance refreshKey={`${selected.id}:${selected.status}:${attempt}`} />}
      <div className="bl-actions">
        <button type="button" className="bl-button bl-button-secondary" onClick={refresh}>Tải lại trạng thái</button>
        {orderId && purchase?.orderId === selected.id && selected.status === "PENDING" && <Link href="/checkout" className="bl-button">Về thanh toán</Link>}
        {orderId && <Link href="/history" className="bl-detail-back">Xem lịch sử đơn</Link>}
        <Link href="/" className="bl-detail-back">Về Menu</Link>
      </div>
    </>
  );
}
