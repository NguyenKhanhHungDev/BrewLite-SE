"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { useCheckout } from "@/components/CheckoutProvider";
import PaymentDetails from "@/components/PaymentDetails";
import CartSummary from "@/components/CartSummary";
import PromotionField from "@/components/PromotionField";
import LoyaltyBalance from "@/components/LoyaltyBalance";
import { paidStatuses, statusNames } from "@/lib/orders";
import { money } from "@/lib/pricing";
import { cartTotal } from "@/lib/cart";
import { previewPromotion } from "@/lib/promotion";

export default function CheckoutPage() {
  const cart = useCart();
  const auth = useAuth();
  const checkout = useCheckout();
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const owned =
    checkout.purchase?.owner === auth.session?.userId
      ? checkout.purchase
      : null;
  // Keep a receipt after success, but let a newly filled cart start a new checkout.
  const purchase =
    owned && (!paidStatuses.includes(owned.status) || !cart.lines.length)
      ? owned
      : null;
  const draft =
    checkout.draft?.owner === auth.session?.userId ? checkout.draft : null;
  const promoCode =
    purchase?.promoCode ?? draft?.promoCode ?? checkout.appliedCode;
  const summaryLines = purchase?.snapshot ?? draft?.snapshot ?? cart.lines;
  const preview = previewPromotion(
    cartTotal(summaryLines),
    promoCode || undefined,
  );
  const busy = checkout.busy || redirecting;
  const terminal = purchase && purchase.status !== "PENDING";
  const paid = purchase && paidStatuses.includes(purchase.status);

  async function createOrder() {
    setError("");
    try {
      await checkout.createOrder(cart.lines, checkout.appliedCode || undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tạo được đơn.");
    }
  }

  async function pay() {
    if (busy) return;
    setError("");
    try {
      const url = await checkout.startPayment();
      setRedirecting(true);
      window.location.assign(url);
    } catch (cause) {
      setRedirecting(false);
      setError(
        cause instanceof Error ? cause.message : "Chưa tạo được thanh toán.",
      );
    }
  }

  return (
    <main className="bl-flow-wrap">
      <Link href="/cart" className="bl-detail-back">
        ← Về giỏ hàng
      </Link>
      <div className="bl-page-title">
        <p className="bl-eyebrow">Nhận tại quầy</p>
        <h1>Thanh toán</h1>
      </div>
      {!cart.ready || !checkout.ready ? (
        <p role="status">Đang tải...</p>
      ) : (
        <>
          {checkout.storageNotice && (
            <p role="status" className="bl-alert">
              {checkout.storageNotice}
            </p>
          )}
          {cart.notice && (
            <p role="status" className="bl-alert">
              {cart.notice}
            </p>
          )}
          {error && (
            <p className="bl-alert bl-alert-error" role="alert">
              {error}
            </p>
          )}
          {!purchase && !draft && !cart.lines.length ? (
            <section className="bl-panel bl-empty">
              <h2>Giỏ hàng trống</h2>
              <Link href="/" className="bl-button">
                Xem Menu
              </Link>
            </section>
          ) : (
            <div className="bl-flow-grid">
              {purchase && <PaymentDetails orderId={purchase.orderId} />}
              <section className="bl-panel" aria-busy={busy}>
                {!auth.session ? (
                  <>
                    <h2>Đăng nhập để tiếp tục</h2>
                    <p>Giỏ hàng được giữ nguyên.</p>
                    <Link href="/login?next=/checkout" className="bl-button">
                      Đăng nhập
                    </Link>
                  </>
                ) : !purchase ? (
                  <>
                    <h2>Xác nhận đơn hàng</h2>
                    {draft && (
                      <p className="bl-alert">
                        Yêu cầu trước chưa có kết quả. Kiểm tra lại để nhận đúng
                        đơn đã gửi.
                      </p>
                    )}
                    <button
                      className="bl-button bl-full"
                      type="button"
                      disabled={busy}
                      onClick={createOrder}
                    >
                      {busy
                        ? "Đang tạo đơn..."
                        : draft
                          ? "Kiểm tra lại yêu cầu"
                          : "Xác nhận tạo đơn"}
                    </button>
                  </>
                ) : (
                  <>
                    <h2>Đơn #{purchase.orderId}</h2>
                    <p>
                      <span
                        className={`bl-status${paid ? " bl-status-paid" : ""}`}
                      >
                        {statusNames[purchase.status]}
                      </span>
                    </p>
                    {!terminal ? (
                      <>
                        <div className="bl-payment-method">
                          <span>Phương thức thanh toán</span>
                          <strong>ZaloPay</strong>
                        </div>
                        <p className="bl-muted bl-payment-note">
                          Đơn được giữ trong 15 phút từ lúc tạo.
                        </p>
                        <button
                          className="bl-button bl-full"
                          type="button"
                          disabled={busy}
                          onClick={pay}
                        >
                          {redirecting
                            ? "Đang chuyển đến ZaloPay..."
                            : checkout.busy
                              ? "Đang kiểm tra..."
                              : `Thanh toán ${money(purchase.total)}`}
                        </button>
                      </>
                    ) : !paid ? (
                      <>
                        <p className="bl-muted">
                          Đơn đã kết thúc. Kiểm tra trạng thái trước khi đặt đơn
                          mới.
                        </p>
                        {!!cart.lines.length && (
                          <button
                            className="bl-button bl-full"
                            type="button"
                            disabled={busy}
                            onClick={createOrder}
                          >
                            {busy ? "Đang tạo đơn..." : "Tạo đơn mới"}
                          </button>
                        )}
                      </>
                    ) : null}
                    <Link
                      href={`/payment/result?orderId=${purchase.orderId}`}
                      className="bl-detail-back bl-payment-link"
                    >
                      Xem trạng thái thanh toán
                    </Link>
                  </>
                )}
              </section>
              <div className="bl-checkout-summary">
                {!purchase && (
                  <section className="bl-panel" aria-label="Khuyến mãi">
                    <PromotionField locked={Boolean(draft)} code={promoCode} />
                  </section>
                )}
                <CartSummary
                  lines={summaryLines}
                  total={purchase?.total}
                  promoCode={promoCode || undefined}
                  showBreakdown
                />
                <LoyaltyBalance
                  refreshKey={
                    purchase
                      ? `${purchase.orderId}:${purchase.status}`
                      : "checkout"
                  }
                  estimatedPoints={Math.floor(
                    (purchase?.total ?? preview.payable) / 10000,
                  )}
                  estimateIsPreview={!purchase}
                />
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
