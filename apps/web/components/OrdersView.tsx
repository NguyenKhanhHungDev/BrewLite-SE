"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { useCheckout } from "./CheckoutProvider";
import OrderCard from "./OrderCard";
import LoyaltyBalance from "./LoyaltyBalance";
import {
  parseHistory,
  paidStatuses,
  type OrderRecord,
  type OrderStatus,
} from "@/lib/orders";
import { ApiError } from "@/lib/api";
import {
  ArrowLeftIcon,
  RefreshIcon,
  ShoppingBagIcon,
  ExclamationIcon,
  CheckCircleIcon,
} from "./Icons";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; orders: OrderRecord[] };

const terminalStatuses: OrderStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "PAYMENT_FAILED",
];

export default function OrdersView({ orderId }: { orderId?: string }) {
  const auth = useAuth();

  return (
    <main className="bl-flow-wrap">
      <nav aria-label="Đường dẫn trang">
        <Link href="/" className="bl-detail-back">
          <ArrowLeftIcon size={18} />
          <span>Về thực đơn</span>
        </Link>
      </nav>

      <div className="bl-page-title">
        <span className="bl-eyebrow">Quản lý nhận tại quầy</span>
        <h1>
          {orderId ? `Chi tiết đơn hàng #${orderId}` : "Lịch sử đặt món"}
        </h1>
      </div>

      {!auth.session ? (
        <section className="bl-panel bl-empty">
          <div className="bl-empty-cart-visual" aria-hidden="true">
            <ShoppingBagIcon size={52} strokeWidth={1.3} />
          </div>
          <h2>
            {auth.expired ? "Phiên đăng nhập đã hết hạn" : "Vui lòng đăng nhập"}
          </h2>
          <p>
            Đăng nhập để theo dõi trạng thái pha chế và tích điểm thưởng cho đơn
            của bạn.
          </p>
          <Link
            className="bl-button bl-button-primary"
            href={`/login?next=${encodeURIComponent(
              orderId ? `/confirmation/${orderId}` : "/history",
            )}`}
          >
            Đăng nhập ngay
          </Link>
        </section>
      ) : (
        <OrdersData
          key={`${auth.session.userId}:${orderId ?? "history"}`}
          orderId={orderId}
        />
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
        const selected =
          orderId === undefined
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
        const message =
          cause instanceof Error ? cause.message : "Không tải được đơn hàng.";
        if (cause instanceof ApiError && [401, 403, 404].includes(cause.status))
          pollingStopped = true;
        if (initial) setState({ status: "error", message });
        else
          setRefreshWarning(
            `${message} Trạng thái đang hiển thị là lần cập nhật thành công gần nhất.`,
          );
      } finally {
        inFlight = false;
      }
    }

    void load(true);
    const interval = orderId
      ? window.setInterval(() => {
          if (
            !pollingStopped &&
            !terminalStatuses.includes(latestStatus.current ?? "PENDING")
          )
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

  if (state.status === "loading") {
    return (
      <div className="bl-menu-state" role="status">
        <span className="bl-spinner-dot" />
        <p>Đang tải dữ liệu đơn hàng...</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <section className="bl-panel">
        <div className="bl-alert bl-alert-error" role="alert">
          <ExclamationIcon size={18} />
          <span>{state.message}</span>
        </div>
        <button className="bl-button bl-button-primary" onClick={refresh}>
          <RefreshIcon size={16} />
          <span>Thử lại</span>
        </button>
      </section>
    );
  }

  if (!state.orders.length) {
    return (
      <section className="bl-panel bl-empty">
        <div className="bl-empty-cart-visual" aria-hidden="true">
          <ShoppingBagIcon size={52} strokeWidth={1.3} />
        </div>
        <h2>
          {orderId ? "Không tìm thấy đơn hàng" : "Bạn chưa có đơn hàng nào"}
        </h2>
        <p>
          {orderId
            ? "Đơn không tồn tại hoặc tài khoản của bạn không có quyền xem đơn này."
            : "Các đơn sau khi đặt sẽ được lưu và hiển thị tại đây."}
        </p>
        <Link href="/" className="bl-button bl-button-primary">
          Khám phá thực đơn
        </Link>
      </section>
    );
  }

  const selected = state.orders[0];

  return (
    <>
      {orderId && (
        <div
          className={`bl-alert ${
            paidStatuses.includes(selected.status)
              ? "bl-alert-success"
              : selected.status === "PAYMENT_FAILED"
                ? "bl-alert-error"
                : "bl-alert-warning"
          }`}
          role="status"
        >
          {paidStatuses.includes(selected.status) ? (
            <div className="bl-alert-row">
              <CheckCircleIcon size={20} />
              <span>
                Thanh toán đã được ghi nhận thành công! Bạn có thể xuất trình mã
                đơn <strong>#{selected.id}</strong> tại quầy để nhận đồ uống khi
                sẵn sàng.
              </span>
            </div>
          ) : selected.status === "PAYMENT_FAILED" ? (
            <div className="bl-alert-row">
              <ExclamationIcon size={20} />
              <span>
                Thanh toán thất bại hoặc đã bị hủy. Giỏ hàng của bạn vẫn được lưu
                nguyên vẹn.
              </span>
            </div>
          ) : selected.status === "CANCELLED" ? (
            <div className="bl-alert-row">
              <ExclamationIcon size={20} />
              <span>
                Đơn hàng đã hết hạn thanh toán (15 phút) hoặc đã bị hủy.
              </span>
            </div>
          ) : (
            <div className="bl-alert-row">
              <RefreshIcon size={20} />
              <span>Đơn hàng đang chờ thanh toán qua ZaloPay.</span>
            </div>
          )}
        </div>
      )}

      {orderId && !terminalStatuses.includes(selected.status) && (
        <p className="bl-muted" style={{ margin: "-0.5rem 0 1rem", fontSize: "0.85rem" }}>
          Trạng thái tự động cập nhật mỗi 5 giây khi bạn ở trang này.
        </p>
      )}

      {refreshWarning && (
        <div className="bl-alert bl-alert-error" role="status">
          <ExclamationIcon size={18} />
          <span>{refreshWarning}</span>
        </div>
      )}

      <div className="bl-order-list">
        {state.orders.map((order) => (
          <div key={order.id} className="bl-order-card-wrapper">
            <OrderCard order={order} />
          </div>
        ))}
      </div>

      {orderId && (
        <div className="bl-confirmation-loyalty">
          <LoyaltyBalance
            refreshKey={`${selected.id}:${selected.status}:${attempt}`}
          />
        </div>
      )}

      <div className="bl-actions bl-order-bottom-actions">
        <button
          type="button"
          className="bl-button bl-button-secondary"
          onClick={refresh}
        >
          <RefreshIcon size={16} />
          <span>Cập nhật trạng thái</span>
        </button>

        {orderId &&
          purchase?.orderId === selected.id &&
          selected.status === "PENDING" && (
            <Link href="/checkout" className="bl-button bl-button-primary">
              Tiếp tục thanh toán
            </Link>
          )}

        {orderId && (
          <Link href="/history" className="bl-button bl-button-ghost">
            Xem toàn bộ lịch sử đơn
          </Link>
        )}
      </div>
    </>
  );
}
