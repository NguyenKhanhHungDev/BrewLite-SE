"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { useToast } from "@/components/Toast";
import ProductImage from "@/components/ProductImage";
import CartSummary from "@/components/CartSummary";
import { requestJson } from "@/lib/api";
import { parseProducts } from "@/lib/products";
import { money, optionText, unitPrice } from "@/lib/pricing";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  ShoppingBagIcon,
  ExclamationIcon,
} from "@/components/Icons";

export default function CartPage() {
  const { lines, ready, notice, issues, changeQuantity, remove, add, reconcile } =
    useCart();
  const toast = useToast();
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    requestJson("/products")
      .then((data) => {
        if (!disposed) reconcile(parseProducts(data));
      })
      .catch(() => {
        if (!disposed)
          setError(
            "Chưa kiểm tra được giá và tồn kho mới nhất. Vui lòng tải lại trang trước khi thanh toán.",
          );
      })
      .finally(() => {
        if (!disposed) setChecking(false);
      });
    return () => {
      disposed = true;
    };
  }, [ready, reconcile]);

  function update(key: string, quantity: number) {
    setError("");
    try {
      changeQuantity(key, quantity);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không đổi được số ly.",
      );
    }
  }

  function handleRemove(line: (typeof lines)[0]) {
    remove(line.key);
    setError("");
    toast.undo(`Đã xóa ${line.product.name} (${line.size}) khỏi giỏ hàng.`, () => {
      add(line.product, line.size, line.toppings, line.quantity);
    });
  }

  const count = lines.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <main className="bl-flow-wrap">
      <nav aria-label="Đường dẫn trang">
        <Link href="/" className="bl-detail-back">
          <ArrowLeftIcon size={18} />
          <span>Tiếp tục chọn món</span>
        </Link>
      </nav>

      <div className="bl-page-title">
        <span className="bl-eyebrow">Đặt món nhận tại quầy</span>
        <h1>Giỏ hàng của bạn</h1>
        {ready && lines.length > 0 && (
          <p className="bl-muted">
            Bạn đang có <strong>{count}</strong> ly trong giỏ hàng. Kiểm tra kỹ trước khi tiến hành thanh toán.
          </p>
        )}
      </div>

      {!ready ? (
        <div className="bl-menu-state" role="status">
          <p>Đang chuẩn bị giỏ hàng...</p>
        </div>
      ) : (
        <>
          {notice && (
            <div className="bl-alert bl-alert-info" role="status">
              {notice}
            </div>
          )}
          {error && (
            <div className="bl-alert bl-alert-error" role="alert">
              <ExclamationIcon size={18} />
              <span>{error}</span>
            </div>
          )}
          {issues.map((issue) => (
            <div className="bl-alert bl-alert-error" role="alert" key={issue}>
              <ExclamationIcon size={18} />
              <span>{issue}</span>
            </div>
          ))}

          {!lines.length ? (
            <section className="bl-panel bl-empty">
              <div className="bl-empty-cart-visual" aria-hidden="true">
                <ShoppingBagIcon size={56} strokeWidth={1.3} />
              </div>
              <h2>Giỏ hàng chưa có món nào</h2>
              <p>Khám phá menu đa dạng từ cà phê pha phin truyền thống đến trà trái cây thanh mát.</p>
              <Link href="/" className="bl-button bl-button-primary">
                <span>Khám phá thực đơn</span>
                <ArrowRightIcon size={18} />
              </Link>
            </section>
          ) : (
            <div className="bl-flow-grid">
              {/* Left Column: Items List */}
              <div className="bl-cart-list">
                {lines.map((line) => {
                  const linePrice = unitPrice(
                    line.product.price,
                    line.size,
                    line.toppings,
                  );
                  const subtotal = linePrice * line.quantity;

                  return (
                    <article className="bl-cart-line" key={line.key}>
                      <div className="bl-cart-image">
                        <ProductImage
                          src={line.product.imageUrl}
                          name={line.product.name}
                        />
                      </div>
                      <div className="bl-cart-content">
                        <div className="bl-cart-line-header">
                          <h2>{line.product.name}</h2>
                          <button
                            type="button"
                            className="bl-btn-remove-line"
                            onClick={() => handleRemove(line)}
                            aria-label={`Xóa ${line.product.name} size ${line.size}`}
                            title="Xóa món"
                          >
                            <TrashIcon size={18} />
                          </button>
                        </div>

                        <p className="bl-cart-option-tag">
                          {optionText(line.size, line.toppings)}
                        </p>

                        <p className="bl-cart-unit-price">
                          Đơn giá: {money(linePrice)}
                        </p>

                        <div className="bl-cart-bottom">
                          <div
                            className="bl-quantity-stepper"
                            role="group"
                            aria-label={`Số lượng cho ${line.product.name}`}
                          >
                            <button
                              type="button"
                              className="bl-stepper-btn"
                              disabled={line.quantity <= 1}
                              aria-label={`Giảm số ly ${line.product.name} ${line.size}`}
                              onClick={() => update(line.key, line.quantity - 1)}
                            >
                              <MinusIcon size={18} />
                            </button>
                            <span className="bl-stepper-val" aria-label="Số ly">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              className="bl-stepper-btn"
                              aria-label={`Tăng số ly ${line.product.name} ${line.size}`}
                              onClick={() => update(line.key, line.quantity + 1)}
                            >
                              <PlusIcon size={18} />
                            </button>
                          </div>
                          <strong className="bl-cart-line-total">
                            {money(subtotal)}
                          </strong>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Right Column: Order Summary & Checkout Action */}
              <div className="bl-cart-sidebar">
                <CartSummary lines={lines} showBreakdown />

                {checking ? (
                  <div className="bl-checking-box" role="status">
                    <span className="bl-spinner-dot" />
                    <span>Đang kiểm tra tồn kho tại quầy...</span>
                  </div>
                ) : issues.length || error ? (
                  <p className="bl-muted bl-checkout-blocked-note">
                    Vui lòng điều chỉnh số lượng hoặc bỏ bớt món vượt tồn kho để tiếp tục thanh toán.
                  </p>
                ) : (
                  <Link href="/checkout" className="bl-button bl-button-primary bl-full bl-btn-checkout">
                    <span>Tiến hành thanh toán</span>
                    <ArrowRightIcon size={19} />
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
