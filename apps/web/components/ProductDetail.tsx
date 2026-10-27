"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { parseProducts, type Product } from "@/lib/products";
import {
  money,
  sizeDelta,
  toppingPrice,
  toppingNames,
  unitPrice,
  type Size,
  type Topping,
} from "@/lib/pricing";
import { useCart } from "./CartProvider";
type ProductState =
  | { status: "loading" }
  | { status: "error" | "not-found" }
  | { status: "ready"; product: Product };

function DetailLoading() {
  return (
    <main className="bl-detail-wrap">
      <p role="status">Đang tải chi tiết sản phẩm...</p>
    </main>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<DetailLoading />}>
      <ProductDetailRoute />
    </Suspense>
  );
}

function ProductDetailRoute() {
  const { id } = useParams<{ id: string }>();
  return <ProductDetail key={id} id={id} />;
}

function ProductDetail({ id }: { id: string }) {
  const [state, setState] = useState<ProductState>({ status: "loading" });
  const [size, setSize] = useState<Size>("M");
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const timer = useRef<number | null>(null);
  const cart = useCart();

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    async function loadProduct() {
      try {
        const response = await fetch(
          `/api/products/${encodeURIComponent(id)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (response.status === 404 || response.status === 400) {
          if (!disposed) setState({ status: "not-found" });
          return;
        }
        if (!response.ok) throw new Error("Products request failed");
        const product = parseProducts([await response.json()])[0];
        const productId = Number(id);
        if (
          !/^\d+$/.test(id) ||
          !Number.isSafeInteger(productId) ||
          product.id !== productId
        ) {
          if (!disposed) setState({ status: "not-found" });
          return;
        }

        if (!disposed) {
          setState(
            product ? { status: "ready", product } : { status: "not-found" },
          );
        }
      } catch {
        if (!disposed) setState({ status: "error" });
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void loadProduct();
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [id]);

  function toggleTopping(topping: Topping) {
    setToppings((current) =>
      current.includes(topping)
        ? current.filter((item) => item !== topping)
        : [...current, topping],
    );
  }

  if (state.status === "loading") return <DetailLoading />;

  if (state.status !== "ready") {
    return (
      <main className="bl-detail-wrap">
        <p role="alert">
          {state.status === "not-found"
            ? "Không tìm thấy sản phẩm"
            : "Không tải được chi tiết sản phẩm. Vui lòng thử lại sau."}
        </p>
        <Link href="/" className="bl-detail-back">
          ← Quay lại thực đơn
        </Link>
      </main>
    );
  }

  const { product } = state;
  let price: number;
  try {
    price = unitPrice(product.price, size, toppings);
  } catch {
    return (
      <main className="bl-detail-wrap">
        <p role="alert">Giá sản phẩm không hợp lệ, chưa thể thêm giỏ.</p>
        <Link href="/">Quay lại thực đơn</Link>
      </main>
    );
  }
  const count = Number(quantity);
  const validQuantity =
    quantity.trim() !== "" &&
    Number.isSafeInteger(count) &&
    count >= 1 &&
    count <= Math.min(99, product.stock);

  function add() {
    setError("");
    setMessage("");
    try {
      if (!validQuantity)
        throw new Error(
          "Số ly phải là số nguyên từ 1–99 và không vượt tồn kho.",
        );
      cart.add(product, size, toppings, count);
      setMessage(`Đã thêm ${count} ly ${product.name} vào giỏ.`);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMessage(""), 3000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thêm được món.");
    }
  }

  return (
    <main className="bl-detail-wrap">
      <Link href="/" className="bl-detail-back">
        ← Quay lại thực đơn
      </Link>
      <section className="bl-detail-panel" aria-labelledby="product-name">
        <div className="bl-detail-image">
          <ProductImage src={product.imageUrl} name={product.name} hero />
          {product.stock === 0 && <span className="bl-soldout">Hết hàng</span>}
        </div>
        <div className="bl-detail-content">
          <p className="bl-eyebrow">Chi tiết đồ uống</p>
          <h1 id="product-name">{product.name}</h1>
          <p className="bl-detail-stock">
            {product.stock === 0 ? "Hết hàng" : `Còn ${product.stock} sản phẩm`}
          </p>
          <p className="bl-detail-base-price">
            Giá size M:{" "}
            <strong>{product.price.toLocaleString("vi-VN")} VND</strong>
          </p>

          <fieldset>
            <legend>Chọn size</legend>
            <div className="bl-detail-sizes">
              {(["S", "M", "L"] as const).map((option) => (
                <label key={option} className="bl-option bl-size-option">
                  <input
                    type="radio"
                    name="size"
                    value={option}
                    checked={size === option}
                    onChange={() => setSize(option)}
                  />
                  <span>
                    <strong>Size {option}</strong>
                    <small>
                      {option === "M"
                        ? "Giá gốc"
                        : `${option === "S" ? "−" : "+"}${Math.abs(sizeDelta[option]).toLocaleString("vi-VN")}đ`}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Chọn topping (không bắt buộc)</legend>
            {(["PEARL", "CREAM"] as const).map((option) => (
              <label key={option} className="bl-option bl-topping-option">
                <input
                  type="checkbox"
                  checked={toppings.includes(option)}
                  onChange={() => toggleTopping(option)}
                />
                <span>{toppingNames[option]}</span>
                <small>+{toppingPrice[option].toLocaleString("vi-VN")}đ</small>
              </label>
            ))}
          </fieldset>

          <p className="bl-detail-total" aria-live="polite" aria-atomic="true">
            <span>Giá tạm tính / ly</span>
            <strong>{money(price)}</strong>
          </p>
          <label className="bl-field bl-detail-quantity">
            Số ly
            <input
              type="number"
              min={1}
              max={Math.min(99, product.stock)}
              step={1}
              value={quantity}
              disabled={product.stock === 0}
              onChange={(event) => setQuantity(event.target.value)}
              aria-describedby="quantity-help"
            />
          </label>
          <p id="quantity-help" className="bl-muted">
            Từ 1–99 ly, không vượt số lượng còn hàng.
          </p>
          <p className="bl-detail-total">
            <span>Thành tiền</span>
            <strong>{validQuantity ? money(price * count) : "—"}</strong>
          </p>
          {error && (
            <p className="bl-alert bl-alert-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="bl-alert" role="status">
              {message}
            </p>
          )}
          <div className="bl-actions">
            <button
              className="bl-button"
              type="button"
              disabled={!cart.ready || product.stock === 0}
              onClick={add}
            >
              Thêm vào giỏ
            </button>
            <Link href="/cart" className="bl-button bl-button-secondary">
              Xem giỏ hàng
            </Link>
            <Link href="/" className="bl-detail-back">
              Tiếp tục chọn món
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
