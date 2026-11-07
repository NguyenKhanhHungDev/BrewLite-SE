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
import {
  CheckCircleIcon,
  ExclamationIcon,
  RefreshIcon,
  ArrowRightIcon,
  SparklesIcon,
  ClockIcon,
} from "./Icons";

const messages: Record<PaymentView, { title: string; copy: string; badgeClass: string }> = {
  pending: {
    title: "Đang chờ xác nhận từ ZaloPay",
    copy: "Hệ thống đang đồng bộ kết quả thanh toán với cổng ZaloPay. Bạn vui lòng chờ trong giây lát...",
    badgeClass: "bl-badge-pending",
  },
  success: {
    title: "Thanh toán thành công!",
    copy: "Giao dịch đã được xác nhận. Barista của BrewLite đang bắt đầu chuẩn bị ly nước thơm ngon cho bạn.",
    badgeClass: "bl-badge-success",
  },
  failed: {
    title: "Thanh toán chưa thành công",
    copy: "Giao dịch bị gián đoạn hoặc bạn đã hủy trên cổng ZaloPay. Bạn có thể thử thanh toán lại hoặc chọn phương thức khác.",
    badgeClass: "bl-badge-failed",
  },
  cancelled: {
    title: "Đơn hàng đã hết hạn hoặc bị hủy",
    copy: "Thời gian giữ nguyên liệu cho đơn này đã kết thúc (15 phút). Vui lòng đặt đơn mới tại thực đơn.",
    badgeClass: "bl-badge-cancelled",
  },
  reconciliation: {
    title: "Giao dịch cần đối soát",
    copy: "Hệ thống ghi nhận trạng thái chưa đồng nhất giữa cổng ZaloPay và đơn hàng. Đừng lo lắng, hãy giữ mã đơn và xuất trình tại quầy để barista hỗ trợ.",
    badgeClass: "bl-badge-recon",
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
  const latestPay = state.payment?.latestPayment;

  return (
    <>
      {storageNotice && (
        <div className="bl-alert bl-alert-info" role="status">
          {storageNotice}
        </div>
      )}

      <div className="bl-flow-grid">
        {/* Left Column: Result Outcome Card */}
        <section
          className={`bl-panel bl-payment-result-panel ${view ? `bl-result-${view}` : ""}`}
          aria-busy={state.loading}
        >
          {/* Header Title with Status Icon */}
          <div className="bl-result-header">
            <div className="bl-result-icon-wrap" aria-hidden="true">
              {view === "success" && <CheckCircleIcon size={36} />}
              {view === "pending" && <ClockIcon size={36} />}
              {view === "failed" && <ExclamationIcon size={36} />}
              {view === "cancelled" && <ExclamationIcon size={36} />}
              {view === "reconciliation" && <RefreshIcon size={36} />}
              {!view && <ClockIcon size={36} />}
            </div>

            <div>
              <span className="bl-eyebrow">Trạng thái giao dịch</span>
              <h2 className="bl-result-title">Đơn hàng #{orderId}</h2>
            </div>
          </div>

          <div className="bl-result-status-block" aria-live="polite">
            {message && (
              <div className={`bl-result-badge-pill ${message.badgeClass}`}>
                {view === "success" && <SparklesIcon size={16} />}
                <span>{message.title}</span>
              </div>
            )}

            {/* Countdown timer if pending and has expiration time */}
            {state.order?.expiresAt && (
              <PaymentCountdown
                expiresAt={state.order.expiresAt}
                isPending={view === "pending"}
                onExpire={() => setRevision((value) => value + 1)}
              />
            )}

            {state.loading ? (
              <div className="bl-polling-box" role="status">
                <span className="bl-spinner-dot" />
                <p>Đang đồng bộ trạng thái thanh toán từ ZaloPay...</p>
              </div>
            ) : state.error ? (
              <div className="bl-alert bl-alert-error" role="alert">
                <ExclamationIcon size={16} />
                <span>{state.error}</span>
              </div>
            ) : (
              <p className="bl-result-copy">
                {state.paused
                  ? "Chưa có xác nhận mới từ cổng thanh toán. Bạn có thể nhấn 'Kiểm tra lại' bên dưới."
                  : message?.copy}
              </p>
            )}

            {/* Gateway Receipt details if available */}
            {latestPay && (
              <div className="bl-gateway-receipt">
                <div className="bl-receipt-row">
                  <span>Cổng thanh toán:</span>
                  <strong>{latestPay.provider}</strong>
                </div>
                {latestPay.transactionRef && (
                  <div className="bl-receipt-row">
                    <span>Mã tham chiếu GD:</span>
                    <code>{latestPay.transactionRef}</code>
                  </div>
                )}
                {latestPay.paidAt && (
                  <div className="bl-receipt-row">
                    <span>Thời gian xác nhận:</span>
                    <span>{new Date(latestPay.paidAt).toLocaleString("vi-VN")}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="bl-result-actions">
            {view === "success" ? (
              <Link
                href={`/confirmation/${orderId}`}
                className="bl-button bl-button-primary bl-full"
              >
                <span>Xem biên nhận & Nhận đồ uống</span>
                <ArrowRightIcon size={18} />
              </Link>
            ) : (
              <>
                <button
                  className="bl-button bl-button-primary bl-full"
                  type="button"
                  disabled={state.loading}
                  onClick={() => setRevision((value) => value + 1)}
                >
                  <RefreshIcon size={18} />
                  <span>{state.loading ? "Đang đồng bộ..." : "Kiểm tra lại trạng thái"}</span>
                </button>

                {(view === "failed" || view === "cancelled") && (
                  <Link href="/cart" className="bl-button bl-button-secondary bl-full">
                    Quay lại giỏ hàng để đặt đơn mới
                  </Link>
                )}
              </>
            )}

            <Link href="/history" className="bl-button bl-button-ghost bl-full">
              Xem lịch sử tất cả đơn hàng
            </Link>
          </div>

          {/* Payment Attempts History (Task T01) */}
          <div className="bl-result-history-wrapper">
            <PaymentHistory orderId={orderId} />
          </div>
        </section>

        {/* Right Column: Order Bill Breakdown */}
        {state.order && (
          <section className="bl-panel bl-order-bill-panel" aria-label="Chi tiết đơn hàng">
            <h3 className="bl-bill-title">Chi tiết đơn hàng</h3>
            <div className="bl-bill-items">
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
                  <span className="bl-bill-subtotal">{money(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="bl-bill-pricing">
              <div className="bl-summary-amount">
                <span>Tiền hàng</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="bl-summary-amount">
                <span>Giảm giá khuyến mãi</span>
                <span className="bl-discount-text">
                  {discount ? `−${money(discount)}` : money(0)}
                </span>
              </div>
              <div className="bl-summary-total">
                <span>{view === "success" ? "Đã thanh toán" : "Tổng tiền đơn hàng"}</span>
                <strong>{money(state.order.total)}</strong>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
