"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { useCheckout } from "@/components/CheckoutProvider";
import CartSummary from "@/components/CartSummary";
import PromotionField from "@/components/PromotionField";
import LoyaltyBalance from "@/components/LoyaltyBalance";
import PaymentCountdown from "@/components/PaymentCountdown";
import { paidStatuses, statusNames } from "@/lib/orders";
import { money } from "@/lib/pricing";
import { cartTotal } from "@/lib/cart";
import { previewPromotion } from "@/lib/promotion";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  QrCodeIcon,
  RefreshIcon,
  ExclamationIcon,
} from "@/components/Icons";

export default function CheckoutPage() {
  const cart = useCart();
  const auth = useAuth();
  const checkout = useCheckout();
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [zalopayUrl, setZalopayUrl] = useState<string | null>(null);

  const owned =
    checkout.purchase?.owner === auth.session?.userId
      ? checkout.purchase
      : null;

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

  // Determine current active step (1 to 4)
  const currentStep = paid ? 4 : zalopayUrl ? 3 : purchase ? 2 : 1;

  async function createOrder() {
    setError("");
    try {
      await checkout.createOrder(cart.lines, checkout.appliedCode || undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo đơn hàng.");
    }
  }

  async function handleStartPayment() {
    if (busy) return;
    setError("");
    try {
      const url = await checkout.startPayment();
      setZalopayUrl(url);
    } catch (cause) {
      setRedirecting(false);
      setError(
        cause instanceof Error ? cause.message : "Chưa tạo được cổng thanh toán ZaloPay.",
      );
    }
  }

  function handleOpenApp() {
    if (!zalopayUrl) return;
    setRedirecting(true);
    window.location.assign(zalopayUrl);
  }

  return (
    <main className="bl-flow-wrap">
      {/* Navigation Breadcrumb */}
      <nav aria-label="Đường dẫn trang">
        <Link href="/cart" className="bl-detail-back">
          <ArrowLeftIcon size={18} />
          <span>Về giỏ hàng</span>
        </Link>
      </nav>

      {/* Page Heading & Stepper */}
      <div className="bl-page-title">
        <span className="bl-eyebrow">Thanh toán an toàn</span>
        <h1>Xác nhận đơn & Thanh toán</h1>

        {/* Short Progress Stepper */}
        <div className="bl-checkout-stepper" aria-label="Tiến trình đặt đơn">
          <div className={`bl-step ${currentStep >= 1 ? "bl-step-active" : ""}`}>
            <span className="bl-step-dot">1</span>
            <span className="bl-step-label">Giỏ hàng</span>
          </div>
          <div className="bl-step-line" />
          <div className={`bl-step ${currentStep >= 2 ? "bl-step-active" : ""}`}>
            <span className="bl-step-dot">2</span>
            <span className="bl-step-label">Tạo đơn</span>
          </div>
          <div className="bl-step-line" />
          <div className={`bl-step ${currentStep >= 3 ? "bl-step-active" : ""}`}>
            <span className="bl-step-dot">3</span>
            <span className="bl-step-label">ZaloPay</span>
          </div>
          <div className="bl-step-line" />
          <div className={`bl-step ${currentStep >= 4 ? "bl-step-active" : ""}`}>
            <span className="bl-step-dot">4</span>
            <span className="bl-step-label">Nhận tại quầy</span>
          </div>
        </div>
      </div>

      {!cart.ready || !checkout.ready ? (
        <div className="bl-menu-state" role="status">
          <p>Đang chuẩn bị phiên thanh toán...</p>
        </div>
      ) : (
        <>
          {checkout.storageNotice && (
            <div role="status" className="bl-alert bl-alert-info">
              {checkout.storageNotice}
            </div>
          )}
          {cart.notice && (
            <div role="status" className="bl-alert bl-alert-info">
              {cart.notice}
            </div>
          )}
          {error && (
            <div
              className={`bl-alert ${
                error.includes("outcome is unknown") || error.includes("in progress")
                  ? "bl-alert-warning"
                  : "bl-alert-error"
              }`}
              role="alert"
            >
              <ExclamationIcon size={20} />
              <div style={{ flex: 1 }}>
                <strong>
                  {error.includes("outcome is unknown") || error.includes("in progress")
                    ? "Giao dịch đang được xử lý hoặc cổng ZaloPay Sandbox phản hồi chậm."
                    : "Lỗi kết nối cổng thanh toán:"}
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: "0.92rem", opacity: 0.95 }}>
                  {error.includes("outcome is unknown") || error.includes("in progress")
                    ? "Hệ thống đã tự động bảo vệ giao dịch để tránh trừ tiền trùng lặp. Vui lòng bấm nút 'Xem trạng thái thanh toán & đối soát' bên dưới để kiểm tra và cập nhật đơn hàng."
                    : error}
                </p>
              </div>
            </div>
          )}

          {!purchase && !draft && !cart.lines.length ? (
            <section className="bl-panel bl-empty">
              <h2>Giỏ hàng chưa có sản phẩm</h2>
              <p>Vui lòng chọn thức uống yêu thích trước khi thanh toán.</p>
              <Link href="/" className="bl-button bl-button-primary">
                Xem thực đơn
              </Link>
            </section>
          ) : (
            <div className="bl-flow-grid">
              {/* Left Column: Checkout Action Form */}
              <section className="bl-panel bl-checkout-panel" aria-busy={busy}>
                {!auth.session ? (
                  <div className="bl-auth-gate">
                    <h2>Đăng nhập để đặt món</h2>
                    <p>
                      Đăng nhập giúp bạn tích điểm thưởng thành viên và lưu lịch sử đơn hàng nhận tại quầy.
                    </p>
                    <Link
                      href="/login?next=/checkout"
                      className="bl-button bl-button-primary bl-full"
                    >
                      <span>Đăng nhập ngay</span>
                      <ArrowRightIcon size={18} />
                    </Link>
                  </div>
                ) : !purchase ? (
                  <div className="bl-order-confirm-box">
                    <h2>Xác nhận đặt đơn</h2>
                    <p className="bl-muted">
                      Đơn hàng sẽ được chuyển tới quầy pha chế ngay sau khi thanh toán thành công.
                    </p>
                    {draft && (
                      <div className="bl-alert bl-alert-warning">
                        Yêu cầu trước đó chưa hoàn tất phản hồi. Bấm nút dưới để kiểm tra lại.
                      </div>
                    )}
                    <button
                      className="bl-button bl-button-primary bl-full bl-btn-submit-order"
                      type="button"
                      disabled={busy}
                      onClick={createOrder}
                    >
                      {busy ? (
                        <>
                          <span className="bl-spinner-dot" />
                          <span>Đang khởi tạo đơn hàng...</span>
                        </>
                      ) : draft ? (
                        "Kiểm tra lại yêu cầu tạo đơn"
                      ) : (
                        <>
                          <span>Xác nhận tạo đơn ({money(preview.payable)})</span>
                          <ArrowRightIcon size={18} />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="bl-order-pay-box">
                    <div className="bl-order-header-badge">
                      <h2>Đơn hàng #{purchase.orderId}</h2>
                      <span className={`bl-status ${paid ? "bl-status-paid" : ""}`}>
                        {statusNames[purchase.status]}
                      </span>
                    </div>

                    {!terminal ? (
                      <>
                        <div className="bl-payment-method-box">
                          <span className="bl-method-label">Phương thức thanh toán</span>
                          <div className="bl-method-badge">
                            <span className="bl-zalopay-pill">ZaloPay Sandbox</span>
                          </div>
                        </div>

                        {/* QR Code Presentation if initiated */}
                        {zalopayUrl ? (
                          <div className="bl-qr-section" aria-label="Mã QR thanh toán ZaloPay">
                            <div className="bl-qr-box">
                              {/* Clean QR code generated via Google Chart API or QR Server with fallback */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(zalopayUrl)}`}
                                alt="Mã QR thanh toán ZaloPay"
                                width={220}
                                height={220}
                                className="bl-qr-img"
                              />
                              <p className="bl-qr-instruction">
                                Quét mã bằng <strong>App ZaloPay</strong> hoặc bấm nút mở ứng dụng bên dưới
                              </p>
                            </div>

                            <button
                              className="bl-button bl-button-primary bl-full"
                              type="button"
                              disabled={busy}
                              onClick={handleOpenApp}
                            >
                              <span>Mở cổng ZaloPay để thanh toán</span>
                              <ArrowRightIcon size={18} />
                            </button>

                            <button
                              className="bl-button bl-button-secondary bl-full"
                              type="button"
                              onClick={() => setZalopayUrl(null)}
                            >
                              Đổi phương thức / Hủy quét mã
                            </button>

                            <Link
                              href={`/payment/result?orderId=${purchase.orderId}`}
                              className="bl-button bl-btn-recheck-prominent"
                              aria-label={`Xem trạng thái thanh toán và đối soát đơn #${purchase.orderId}`}
                            >
                              <RefreshIcon size={18} />
                              <span>Xem trạng thái thanh toán & đối soát</span>
                            </Link>
                          </div>
                        ) : (
                          <div className="bl-pay-cta-box">
                            <p className="bl-muted bl-payment-note">
                              Đơn hàng sẽ được giữ nguyên liệu trong 15 phút. Vui lòng thanh toán để quầy tiến hành pha chế.
                            </p>
                            <button
                              className="bl-button bl-button-primary bl-full bl-btn-pay"
                              type="button"
                              disabled={busy}
                              onClick={handleStartPayment}
                            >
                              {busy ? (
                                <>
                                  <span className="bl-spinner-dot" />
                                  <span>Đang kết nối cổng ZaloPay...</span>
                                </>
                              ) : (
                                <>
                                  <QrCodeIcon size={20} />
                                  <span>Thanh toán {money(purchase.total)} qua ZaloPay</span>
                                </>
                              )}
                            </button>

                            <Link
                              href={`/payment/result?orderId=${purchase.orderId}`}
                              className="bl-button bl-btn-recheck-prominent"
                              aria-label={`Xem trạng thái thanh toán và đối soát đơn #${purchase.orderId}`}
                            >
                              <RefreshIcon size={18} />
                              <span>Xem trạng thái thanh toán & đối soát</span>
                            </Link>
                          </div>
                        )}
                      </>
                    ) : !paid ? (
                      <div className="bl-order-terminal-notice">
                        <p className="bl-muted">
                          Đơn hàng đã hết hạn hoặc bị hủy. Bạn có thể kiểm tra lịch sử hoặc khởi tạo đơn mới.
                        </p>
                        {!!cart.lines.length && (
                          <button
                            className="bl-button bl-button-primary bl-full"
                            type="button"
                            disabled={busy}
                            onClick={createOrder}
                          >
                            <span>Tạo đơn mới từ giỏ hàng</span>
                          </button>
                        )}
                        <Link
                          href={`/payment/result?orderId=${purchase.orderId}`}
                          className="bl-button bl-btn-recheck-prominent"
                          aria-label={`Xem trạng thái thanh toán và đối soát đơn #${purchase.orderId}`}
                        >
                          <RefreshIcon size={18} />
                          <span>Xem trạng thái thanh toán & đối soát</span>
                        </Link>
                      </div>
                    ) : (
                      <div className="bl-pay-cta-box">
                        <Link
                          href={`/payment/result?orderId=${purchase.orderId}`}
                          className="bl-button bl-btn-recheck-prominent"
                          aria-label={`Xem trạng thái thanh toán và đối soát đơn #${purchase.orderId}`}
                        >
                          <RefreshIcon size={18} />
                          <span>Xem trạng thái thanh toán & đối soát</span>
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Right Column: Order Summary & Promotion & Loyalty */}
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
