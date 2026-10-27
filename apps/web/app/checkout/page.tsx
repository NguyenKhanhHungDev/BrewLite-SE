"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { useCheckout } from "@/components/CheckoutProvider";
import CartSummary from "@/components/CartSummary";
import {
  paidStatuses,
  statusNames,
  type PaymentMethod,
  type SimulateResult,
} from "@/lib/orders";
import { money } from "@/lib/pricing";
import { cartTotal } from "@/lib/cart";

export default function CheckoutPage() {
  const cart = useCart();
  const auth = useAuth();
  const checkout = useCheckout();
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("WALLET");
  const [simulateResult, setSimulateResult] =
    useState<SimulateResult>("SUCCESS");
  const [error, setError] = useState("");
  const owned =
    checkout.purchase?.owner === auth.session?.userId
      ? checkout.purchase
      : null;
  const purchase =
    owned &&
    !paidStatuses.includes(owned.status) &&
    owned.status !== "CANCELLED"
      ? owned
      : null;
  const attempt = purchase ? checkout.attempt : null;
  const draft =
    checkout.draft?.owner === auth.session?.userId ? checkout.draft : null;

  async function createOrder() {
    setError("");
    try {
      const order = await checkout.createOrder(cart.lines);
      if (paidStatuses.includes(order.status) || order.status === "CANCELLED") {
        router.push(`/confirmation/${order.orderId}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tạo được đơn.");
    }
  }
  async function pay() {
    setError("");
    try {
      const order = await checkout.pay(method, simulateResult);
      router.push(`/confirmation/${order.orderId}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Chưa xác nhận được kết quả thanh toán.",
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
        <p>Kiểm tra món và tổng tiền trước khi xác nhận.</p>
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
              <section className="bl-panel">
                {!auth.session ? (
                  <>
                    <h2>Đăng nhập để tiếp tục</h2>
                    <p>Giỏ hàng của bạn được giữ nguyên.</p>
                    {auth.expired && <p>Phiên đăng nhập đã hết hạn.</p>}
                    <Link href="/login?next=/checkout" className="bl-button">
                      Đăng nhập
                    </Link>
                  </>
                ) : !purchase ? (
                  <>
                    <h2>Xác nhận đơn hàng</h2>
                    <p>Giá và tồn kho sẽ được máy chủ kiểm tra khi tạo đơn.</p>
                    {checkout.draft?.owner === auth.session.userId && (
                      <p className="bl-alert">
                        Yêu cầu tạo đơn trước chưa có kết quả. Kiểm tra lại để
                        nhận đúng đơn đã gửi.
                      </p>
                    )}
                    <button
                      className="bl-button"
                      type="button"
                      disabled={checkout.busy}
                      onClick={createOrder}
                    >
                      {checkout.busy
                        ? "Đang tạo đơn..."
                        : checkout.draft
                          ? "Kiểm tra lại yêu cầu tạo đơn"
                          : "Xác nhận tạo đơn"}
                    </button>
                  </>
                ) : (
                  <>
                    <h2>Đơn #{purchase.orderId}</h2>
                    <p>
                      <span className="bl-status">{purchase.status}</span> ·{" "}
                      {statusNames[purchase.status]}
                    </p>
                    <p>
                      Tổng tiền đã chốt:{" "}
                      <strong>{money(purchase.total)}</strong>
                    </p>
                    {purchase.total !== cartTotal(purchase.snapshot) && (
                      <p className="bl-alert" role="status">
                        Tổng tiền máy chủ khác tạm tính ban đầu. Hãy kiểm tra
                        tổng đã chốt trước khi thanh toán.
                      </p>
                    )}
                    <p className="bl-muted">
                      Danh sách món thuộc đơn đã tạo. Thay đổi giỏ không sửa đơn
                      này.
                    </p>
                    {attempt && (
                      <p className="bl-alert" role="status">
                        Chưa nhận được kết quả thanh toán. Hãy kiểm tra lại lần
                        thanh toán trước khi đổi phương thức.
                      </p>
                    )}
                    <fieldset
                      className="bl-payment-options"
                      disabled={checkout.busy || Boolean(attempt)}
                    >
                      <legend>Phương thức thanh toán</legend>
                      {(["WALLET", "CARD"] as const).map((value) => (
                        <label className="bl-payment-option" key={value}>
                          <input
                            type="radio"
                            name="payment-method"
                            value={value}
                            checked={(attempt?.body.method ?? method) === value}
                            onChange={() => setMethod(value)}
                          />
                          <span>
                            <strong>
                              {value === "WALLET"
                                ? "Ví điện tử"
                                : "Thẻ mô phỏng"}
                            </strong>
                            <small>{value}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <label className="bl-field">
                      Kết quả mô phỏng
                      <select
                        disabled={checkout.busy || Boolean(attempt)}
                        value={attempt?.body.simulateResult ?? simulateResult}
                        onChange={(event) =>
                          setSimulateResult(
                            event.target.value as SimulateResult,
                          )
                        }
                      >
                        <option value="SUCCESS">Thành công</option>
                        <option value="FAILURE">Thất bại</option>
                      </select>
                    </label>
                    <p className="bl-muted">
                      Thanh toán giả lập, không thu tiền thật và không nhập
                      thông tin thẻ thật.
                    </p>
                    <button
                      className="bl-button bl-full"
                      type="button"
                      disabled={checkout.busy}
                      onClick={pay}
                    >
                      {checkout.busy
                        ? "Đang xử lý..."
                        : attempt
                          ? "Kiểm tra lại kết quả thanh toán"
                          : `Thanh toán ${money(purchase.total)}`}
                    </button>
                    <Link
                      href={`/confirmation/${purchase.orderId}`}
                      className="bl-detail-back"
                    >
                      Xem trạng thái đơn
                    </Link>
                  </>
                )}
              </section>
              <CartSummary
                lines={purchase?.snapshot ?? draft?.snapshot ?? cart.lines}
                total={purchase?.total}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}
