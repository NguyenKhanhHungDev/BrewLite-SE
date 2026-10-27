"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { parseProducts, type Product } from "@/lib/products";

type Size = "S" | "M" | "L";
type Topping = "PEARL" | "CREAM";
type ProductState =
  | { status: "loading" }
  | { status: "error" | "not-found" }
  | { status: "ready"; product: Product };

const sizePrices: Record<Size, number> = { S: -5000, M: 0, L: 5000 };
const toppingPrices: Record<Topping, number> = { PEARL: 5000, CREAM: 7000 };
const toppingNames: Record<Topping, string> = {
  PEARL: "Trân châu",
  CREAM: "Kem",
};

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

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    async function loadProduct() {
      try {
        const response = await fetch("/products", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Products request failed");
        const products = parseProducts(await response.json());
        const productId = Number(id);
        const product = /^\d+$/.test(id) && Number.isSafeInteger(productId)
          ? products.find((item) => item.id === productId)
          : undefined;

        if (!disposed) {
          setState(product ? { status: "ready", product } : { status: "not-found" });
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
        <Link href="/" className="bl-detail-back">← Quay lại thực đơn</Link>
      </main>
    );
  }

  const { product } = state;
  const unitPrice = product.price + sizePrices[size]
    + toppings.reduce((total, topping) => total + toppingPrices[topping], 0);

  return (
    <main className="bl-detail-wrap">
      <Link href="/" className="bl-detail-back">← Quay lại thực đơn</Link>
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
            Giá size M: <strong>{product.price.toLocaleString("vi-VN")} VND</strong>
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
                        : `${option === "S" ? "−" : "+"}${Math.abs(sizePrices[option]).toLocaleString("vi-VN")}đ`}
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
                <small>+{toppingPrices[option].toLocaleString("vi-VN")}đ</small>
              </label>
            ))}
          </fieldset>

          <p className="bl-detail-total" aria-live="polite" aria-atomic="true">
            <span>Giá tạm tính / ly</span>
            <strong>{unitPrice.toLocaleString("vi-VN")} VND</strong>
          </p>
        </div>
      </section>
    </main>
  );
}
