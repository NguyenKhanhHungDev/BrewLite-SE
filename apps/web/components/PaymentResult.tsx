"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { useCheckout } from "./CheckoutProvider";
import PaymentCountdown from "./PaymentCountdown";
import PaymentHistory from "./PaymentHistory";
import { ApiError } from "@/lib/api";
import { money, optionText, type Size, type Topping } from "@/lib/pricing";
import {
  parsePaymentOrder,
  parsePaymentStatus,
  paymentView,
  type PaymentOrder,
  type PaymentStatus,
  type PaymentView,
} from "@/lib/payments";

const messages: Record<PaymentView, { title: string; copy: string }> = {
  pending: {
    title: "Đang chờ xác nhận",
    copy: "Chưa có kết quả thanh toán. Chưa cần thanh toán lại.",
  },
  success: {
    title: "Thanh toán thành công",
    copy: "Thanh toán đã được ghi nhận.",
  },
  failed: {
    title: "Thanh toán thất bại",
    copy: "Kiểm tra lịch sử trước khi đặt đơn mới.",
  },
  cancelled: {
    title: "Đơn đã hủy hoặc hết hạn",
    copy: "Đơn này không còn được thanh toán.",
  },
  reconciliation: {
    title: "Cần đối soát",
    copy: "Vui lòng liên hệ quầy với mã đơn. Chưa thanh toán lại.",
  },
};

type State = {
  order: PaymentOrder | null;
  payment: PaymentStatus | null;
  loading: boolean;
  paused: boolean;
  error: string;
};

export default function PaymentResult({ orderId }: { orderId: number }) {
  const { request } = useAuth();
  const { syncPayment, storageNotice } = useCheckout();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State>({
    order: null,
    payment: null,
    loading: true,
    paused: false,
    error: "",
  });

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const deadline = setTimeout(() => {
      controller.abort();
      if (!disposed)
        setState((previous) => ({ ...previous, loading: false, paused: true }));
    }, 60_000);

    async function check(order: PaymentOrder) {
      const status = parsePaymentStatus(
        await request(`/payments/${orderId}/status`, {
          signal: controller.signal,
        }),
        orderId,
      );
      if (disposed || controller.signal.aborted) return;
      if (status.latestPayment && status.latestPayment.amount !== order.total)
        throw new Error(
          "Số tiền thanh toán không khớp đơn hàng. Vui lòng kiểm tra tại quầy.",
        );
      syncPayment(status);
      setState({
        order,
        payment: status,
        loading: false,
        paused: false,
        error: "",
      });
      if (paymentView(status) === "pending")
        timer = setTimeout(() => {
          void poll(order);
        }, 3_000);
      else clearTimeout(deadline);
    }
    function failure(cause: unknown) {
      if (disposed || controller.signal.aborted) return;
      clearTimeout(deadline);
      const error =
        cause instanceof ApiError && cause.status === 404
          ? "Không tìm thấy đơn hoặc chức năng thanh toán chưa sẵn sàng."
          : cause instanceof Error
            ? cause.message
            : "Chưa kiểm tra được thanh toán.";
      setState((previous) => ({
        ...previous,
        payment: null,
        loading: false,
        paused: false,
        error,
      }));
    }
    async function poll(order: PaymentOrder) {
      try {
        await check(order);
      } catch (cause) {
        failure(cause);
      }
    }
    async function load() {
      await Promise.resolve();
      if (disposed) return;
      setState((previous) => ({
        ...previous,
        loading: true,
        paused: false,
        error: "",
      }));
      try {
        const order = parsePaymentOrder(
          await request(`/orders/${orderId}`, { signal: controller.signal }),
          orderId,
        );
        if (disposed || controller.signal.aborted) return;
        setState((previous) => ({ ...previous, order }));
        await check(order);
      } catch (cause) {
        failure(cause);
      }
    }
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(deadline);
      controller.abort();
    };
  }, [orderId, request, syncPayment, revision]);

  const view = state.payment ? paymentView(state.payment) : null;
  const message = view ? messages[view] : null;
  const subtotal =
    state.order?.items.reduce((sum, item) => sum + item.subtotal, 0) ?? 0;
  const discount = state.order ? Math.max(0, subtotal - state.order.total) : 0;

  return (
    <>
      {storageNotice && (
        <p className="bl-alert" role="status">
          {storageNotice}
        </p>
      )}
      <div className="bl-flow-grid">
        <section className="bl-panel" aria-busy={state.loading}>
          <h2>Đơn #{orderId}</h2>
          <div aria-live="polite">
            {message && (
              <p>
                <span
                  className={`bl-status${view === "success" ? " bl-status-paid" : ""}`}
                >
                  {message.title}
                </span>
              </p>
            )}
            {state.order?.expiresAt && (
              <PaymentCountdown
                expiresAt={state.order.expiresAt}
                isPending={view === "pending"}
                onExpire={() => setRevision((value) => value + 1)}
              />
            )}
            {state.loading ? (
              <p role="status">Đang kiểm tra thanh toán...</p>
            ) : state.error ? (
              <p className="bl-alert bl-alert-error" role="alert">
                {state.error}
              </p>
            ) : (
              <p className="bl-muted">
                {state.paused
                  ? "Chưa có xác nhận mới. Bạn có thể kiểm tra lại sau."
                  : message?.copy}
              </p>
            )}
          </div>
          {view === "success" ? (
            <Link
              href={`/confirmation/${orderId}`}
              className="bl-button bl-full"
            >
              Xem đơn hàng
            </Link>
          ) : (
            <>
              <button
                className="bl-button bl-full"
                type="button"
                disabled={state.loading}
                onClick={() => setRevision((value) => value + 1)}
              >
                {state.loading ? "Đang kiểm tra..." : "Kiểm tra lại"}
              </button>
              {(view === "failed" || view === "cancelled") && (
                <Link href="/cart" className="bl-detail-back bl-payment-link">
                  Về giỏ hàng
                </Link>
              )}
            </>
          )}
          <Link href="/history" className="bl-detail-back bl-payment-link">
            Lịch sử đơn hàng
          </Link>
          <PaymentHistory orderId={orderId} />
        </section>
        {state.order && (
          <section className="bl-panel" aria-label="Tóm tắt đơn hàng">
            <h2>Tóm tắt đơn hàng</h2>
            {state.order.items.map((item, index) => (
              <div className="bl-summary-line" key={index}>
                <div className="bl-payment-summary-name">
                  <strong>
                    {item.quantity} × {item.name}
                  </strong>
                  <small>
                    {optionText(item.size as Size, item.toppings as Topping[])}
                  </small>
                </div>
              </div>
            ))}
            <div className="bl-summary-amount">
              <span>Tiền hàng</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="bl-summary-amount">
              <span>Giảm giá đã chốt</span>
              <span>{discount ? `−${money(discount)}` : money(0)}</span>
            </div>
            <div className="bl-summary-total">
              <span>
                {view === "success" ? "Đã thanh toán" : "Tổng phải trả"}
              </span>
              <strong>{money(state.order.total)}</strong>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
