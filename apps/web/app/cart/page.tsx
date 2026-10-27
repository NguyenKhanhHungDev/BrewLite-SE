"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import ProductImage from "@/components/ProductImage";
import CartSummary from "@/components/CartSummary";
import { requestJson } from "@/lib/api";
import { parseProducts } from "@/lib/products";
import { money, optionText, unitPrice } from "@/lib/pricing";

export default function CartPage() {
  const { lines, ready, notice, issues, changeQuantity, remove, reconcile } =
    useCart();
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
  return (
    <main className="bl-flow-wrap">
      <Link href="/" className="bl-detail-back">
        ← Tiếp tục chọn món
      </Link>
      <div className="bl-page-title">
        <p className="bl-eyebrow">BrewLite</p>
        <h1>Giỏ hàng</h1>
      </div>
      {!ready ? (
        <p role="status">Đang khôi phục giỏ hàng...</p>
      ) : (
        <>
          {notice && (
            <p className="bl-alert" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="bl-alert bl-alert-error" role="alert">
              {error}
            </p>
          )}
          {issues.map((issue) => (
            <p className="bl-alert bl-alert-error" role="alert" key={issue}>
              {issue}
            </p>
          ))}
          {!lines.length ? (
            <section className="bl-panel bl-empty">
              <h2>Giỏ hàng trống</h2>
              <p>Chọn món yêu thích từ thực đơn.</p>
              <Link href="/" className="bl-button">
                Xem Menu
              </Link>
            </section>
          ) : (
            <div className="bl-flow-grid">
              <div className="bl-cart-list">
                {lines.map((line) => (
                  <article className="bl-cart-line" key={line.key}>
                    <div className="bl-cart-image">
                      <ProductImage
                        src={line.product.imageUrl}
                        name={line.product.name}
                      />
                    </div>
                    <div className="bl-cart-content">
                      <h2>{line.product.name}</h2>
                      <p>{optionText(line.size, line.toppings)}</p>
                      <p>
                        Đơn giá:{" "}
                        {money(
                          unitPrice(
                            line.product.price,
                            line.size,
                            line.toppings,
                          ),
                        )}
                      </p>
                      <div className="bl-cart-bottom">
                        <div className="bl-quantity-control">
                          <button
                            type="button"
                            disabled={line.quantity <= 1}
                            aria-label={`Giảm số ly ${line.product.name} ${line.size}`}
                            onClick={() => update(line.key, line.quantity - 1)}
                          >
                            −
                          </button>
                          <span aria-label="Số ly">{line.quantity}</span>
                          <button
                            type="button"
                            aria-label={`Tăng số ly ${line.product.name} ${line.size}`}
                            onClick={() => update(line.key, line.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                        <strong>
                          {money(
                            unitPrice(
                              line.product.price,
                              line.size,
                              line.toppings,
                            ) * line.quantity,
                          )}
                        </strong>
                      </div>
                      <button
                        type="button"
                        className="bl-text-button"
                        onClick={() => {
                          remove(line.key);
                          setError("");
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <div>
                <CartSummary lines={lines} />
                {checking ? (
                  <p role="status">Đang kiểm tra giá và tồn kho...</p>
                ) : issues.length || error ? (
                  <p className="bl-muted">
                    Hãy xử lý lỗi trong giỏ trước khi thanh toán.
                  </p>
                ) : (
                  <Link href="/checkout" className="bl-button bl-full">
                    Thanh toán
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
