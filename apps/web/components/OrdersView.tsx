"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { useCheckout } from "./CheckoutProvider";
import OrderCard from "./OrderCard";
import LoyaltyBalance from "./LoyaltyBalance";
import { requestJson } from "@/lib/api";
import { parseHistory, paidStatuses, type OrderRecord } from "@/lib/orders";
import { parseProducts, type Product } from "@/lib/products";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; orders: OrderRecord[]; products: Product[] };

export default function OrdersView({ orderId }: { orderId?: string }) {
  const auth = useAuth();
  return (
    <main className="bl-flow-wrap">
      <Link href="/" className="bl-detail-back">
        ← Về Menu
      </Link>
      <div className="bl-page-title">
        <p className="bl-eyebrow">Đơn hàng của bạn</p>
        <h1>{orderId ? "Xác nhận đơn hàng" : "Lịch sử đơn hàng"}</h1>
      </div>
      {!auth.session ? (
        <section className="bl-panel bl-empty">
          <h2>
            {auth.expired ? "Phiên đăng nhập đã hết hạn" : "Vui lòng đăng nhập"}
          </h2>
          <p>Đăng nhập để xem đơn hàng của chính bạn.</p>
          <Link
            className="bl-button"
            href={`/login?next=${encodeURIComponent(orderId ? `/confirmation/${orderId}` : "/history")}`}
          >
            Đăng nhập
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
  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const orders = parseHistory(await request("/orders/me"));
        let products: Product[] = [];
        try {
          products = parseProducts(await requestJson("/products"));
        } catch {}
        if (disposed) return;
        const selected =
          orderId === undefined
            ? orders
            : orders.filter((order) => String(order.id) === orderId);
        selected.forEach(syncOrder);
        setState({ status: "ready", orders: selected, products });
      } catch (cause) {
        if (!disposed)
          setState({
            status: "error",
            message:
              cause instanceof Error
                ? cause.message
                : "Không tải được đơn hàng.",
          });
      }
    }
    void load();
    return () => {
      disposed = true;
    };
  }, [request, orderId, attempt, syncOrder]);

  function refresh() {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }
  if (state.status === "loading")
    return <p role="status">Đang tải dữ liệu đơn hàng...</p>;
  if (state.status === "error")
    return (
      <section className="bl-panel">
        <p className="bl-alert bl-alert-error" role="alert">
          {state.message}
        </p>
        <button className="bl-button" onClick={refresh}>
          Thử lại
        </button>
      </section>
    );
  if (!state.orders.length)
    return (
      <section className="bl-panel bl-empty">
        <h2>{orderId ? "Không tìm thấy đơn hàng" : "Chưa có đơn hàng"}</h2>
        <p>
          {orderId
            ? "Đơn không tồn tại hoặc bạn không có quyền xem."
            : "Các đơn đã tạo sẽ xuất hiện tại đây."}
        </p>
        <Link href="/" className="bl-button">
          Xem Menu
        </Link>
      </section>
    );
  const selected = state.orders[0];
  return (
    <>
      {orderId && (
        <p
          className={`bl-alert${selected.status === "PAYMENT_FAILED" ? " bl-alert-error" : ""}`}
          role="status"
        >
          {paidStatuses.includes(selected.status)
            ? "Thanh toán đã được xác nhận. Nhận đồ uống tại quầy khi đơn sẵn sàng."
            : selected.status === "PAYMENT_FAILED"
              ? "Thanh toán thất bại. Giỏ hàng được giữ nguyên."
              : selected.status === "CANCELLED"
                ? "Đơn hàng đã bị hủy."
                : "Đơn đang chờ thanh toán. Chưa có xác nhận thanh toán thành công."}
        </p>
      )}
      <div className="bl-order-list">
        {state.orders.map((order) => (
          <div key={order.id}>
            <OrderCard order={order} products={state.products} />
            {!orderId && (
              <Link
                href={`/confirmation/${order.id}`}
                className="bl-detail-back"
              >
                Xem trạng thái đơn →
              </Link>
            )}
          </div>
        ))}
      </div>
      {orderId && (
        <LoyaltyBalance
          refreshKey={`${selected.id}:${selected.status}:${attempt}`}
        />
      )}
      <div className="bl-actions">
        <button
          type="button"
          className="bl-button bl-button-secondary"
          onClick={refresh}
        >
          Tải lại trạng thái
        </button>
        {orderId &&
          purchase?.orderId === selected.id &&
          ["PENDING", "PAYMENT_FAILED"].includes(selected.status) && (
            <Link href="/checkout" className="bl-button">
              Về thanh toán
            </Link>
          )}
        {orderId && (
          <Link href="/history" className="bl-detail-back">
            Xem lịch sử đơn
          </Link>
        )}
        <Link href="/" className="bl-detail-back">
          Về Menu
        </Link>
      </div>
    </>
  );
}
