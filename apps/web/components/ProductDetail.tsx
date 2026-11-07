"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { parseProducts, type Product } from "@/lib/products";
import {
  money,
  sizePrice,
  toppingPrice,
  toppingNames,
  unitPrice,
  type Size,
  type Topping,
} from "@/lib/pricing";
import { useCart } from "./CartProvider";
import { useToast } from "./Toast";
import {
  ArrowLeftIcon,
  PlusIcon,
  MinusIcon,
  CheckCircleIcon,
  ExclamationIcon,
  ShoppingBagIcon,
  SparklesIcon,
} from "./Icons";

type ProductState =
  | { status: "loading" }
  | { status: "error" | "not-found" }
  | { status: "ready"; product: Product };

function DetailLoading() {
  return (
    <main className="bl-detail-wrap" aria-busy="true">
      <div className="bl-detail-loading-box">
        <p className="bl-loading-text" role="status">
          Đang lấy thông tin món...
        </p>
        <div className="bl-detail-panel">
          <div className="bl-skeleton-image shimmer" style={{ aspectRatio: 0.88, borderRadius: 16 }} />
          <div className="bl-skeleton-content">
            <div className="bl-skeleton-line shimmer bl-sk-title" />
            <div className="bl-skeleton-line shimmer bl-sk-price" />
            <div className="bl-skeleton-line shimmer" style={{ width: "80%", height: 40 }} />
          </div>
        </div>
      </div>
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
  const [iceLevel, setIceLevel] = useState<string>("100");
  const [sweetLevel, setSweetLevel] = useState<string>("100");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const cart = useCart();
  const toast = useToast();

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
        <div className="bl-menu-state bl-menu-state-error" role="alert">
          <div className="bl-state-symbol">
            <ExclamationIcon size={24} />
          </div>
          <h3>
            {state.status === "not-found"
              ? "Không tìm thấy món"
              : "Không thể tải chi tiết món"}
          </h3>
          <p>Món bạn đang tìm có thể đã ngừng phục vụ hoặc đường dẫn không đúng.</p>
          <Link href="/" className="bl-button bl-button-primary">
            <ArrowLeftIcon size={18} />
            <span>Quay lại thực đơn</span>
          </Link>
        </div>
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
        <div className="bl-alert bl-alert-error" role="alert">
          Giá sản phẩm chưa hợp lệ. Vui lòng quay lại thực đơn.
        </div>
        <Link href="/" className="bl-detail-back">
          ← Quay lại thực đơn
        </Link>
      </main>
    );
  }

  const stock = product.stockBySize?.[size] ?? product.stock;
  const isSoldOut = stock <= 0;

  function handleQuantityChange(delta: number) {
    const next = quantity + delta;
    if (next >= 1 && next <= Math.min(99, stock)) {
      setQuantity(next);
      setError("");
    }
  }

  function handleAddToCart() {
    setError("");
    if (isSoldOut) {
      setError("Món này hiện đang tạm hết nguyên liệu cho size đã chọn.");
      return;
    }
    try {
      cart.add(product, size, toppings, quantity);
      toast.success(
        `Đã thêm ${quantity} ly ${product.name} (Size ${size}) vào giỏ hàng!`
      );
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "Chưa thể thêm vào giỏ hàng.";
      setError(msg);
      toast.error(msg);
    }
  }

  const totalPrice = price * quantity;

  return (
    <main className="bl-detail-wrap">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Đường dẫn trang" className="bl-detail-nav">
        <Link href="/" className="bl-detail-back">
          <ArrowLeftIcon size={18} />
          <span>Về thực đơn</span>
        </Link>
        <span className="bl-nav-sep" aria-hidden="true">/</span>
        <span className="bl-nav-current">{product.name}</span>
      </nav>

      <section className="bl-detail-panel" aria-labelledby="product-name">
        {/* Left Column: Image Container */}
        <div className="bl-detail-image-box">
          <div className="bl-detail-image">
            <ProductImage src={product.imageUrl} name={product.name} hero />
            {isSoldOut && (
              <div className="bl-soldout-overlay">
                <span className="bl-soldout-badge">
                  <ExclamationIcon size={14} /> Tạm hết size {size}
                </span>
              </div>
            )}
          </div>
          <div className="bl-artisan-stamp">
            <SparklesIcon size={16} />
            <span>Pha chế thủ công nguyên vị</span>
          </div>
        </div>

        {/* Right Column: Customization & Actions */}
        <div className="bl-detail-content">
          <div className="bl-detail-header">
            <span className="bl-eyebrow">Thức uống thủ công</span>
            <h1 id="product-name">{product.name}</h1>
            <p className="bl-detail-desc">
              Pha chế trực tiếp từ nguồn nguyên liệu tươi mới, giữ trọn hương vị nguyên bản và năng lượng sảng khoái.
            </p>
            <div className="bl-detail-price-line">
              <span className="bl-detail-price-label">Đơn giá size M:</span>
              <strong className="bl-detail-base-price">
                {product.price.toLocaleString("vi-VN")} VND
              </strong>
            </div>
            <p className={`bl-detail-stock-status ${isSoldOut ? "bl-stock-empty" : ""}`}>
              {isSoldOut ? (
                <span>
                  <ExclamationIcon size={15} /> Tạm hết nguyên liệu cho size {size}
                </span>
              ) : (
                <span>
                  <CheckCircleIcon size={15} /> Còn <strong>{stock}</strong> ly sẵn sàng pha
                </span>
              )}
            </p>
          </div>

          {/* Size Selection Group */}
          <fieldset className="bl-custom-group">
            <legend className="bl-custom-legend">
              1. Chọn kích cỡ ly <span className="bl-required">(Bắt buộc)</span>
            </legend>
            <div className="bl-size-grid" role="radiogroup" aria-label="Chọn kích cỡ ly">
              {(["S", "M", "L"] as const).map((option) => {
                const optPrice = sizePrice(product.price, option);
                const optStock = product.stockBySize?.[option] ?? product.stock;
                const optDisabled = optPrice === null || optStock <= 0;
                const isSelected = size === option;

                return (
                  <label
                    key={option}
                    className={`bl-size-chip ${isSelected ? "bl-size-chip-active" : ""} ${optDisabled ? "bl-chip-disabled" : ""}`}
                  >
                    <input
                      type="radio"
                      name="size"
                      value={option}
                      disabled={optDisabled}
                      checked={isSelected}
                      onChange={() => setSize(option)}
                      className="sr-only"
                    />
                    <div className="bl-size-chip-header">
                      <strong className="bl-size-chip-name">Size {option}</strong>
                      <span className="bl-size-chip-price">
                        {optPrice !== null ? money(optPrice) : "Không áp dụng"}
                      </span>
                    </div>
                    <span className="bl-size-chip-stock">
                      {optStock <= 0 ? "Hết hàng" : `Còn ${optStock} ly`}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Topping Selection Group */}
          <fieldset className="bl-custom-group">
            <legend className="bl-custom-legend">
              2. Thêm topping đậm đà <span className="bl-optional">(Tùy chọn)</span>
            </legend>
            <div className="bl-topping-list">
              {(["PEARL", "CREAM"] as const).map((option) => {
                const isChecked = toppings.includes(option);
                return (
                  <label
                    key={option}
                    className={`bl-topping-card ${isChecked ? "bl-topping-card-active" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleTopping(option)}
                      className="bl-checkbox"
                    />
                    <div className="bl-topping-info">
                      <span className="bl-topping-name">{toppingNames[option]}</span>
                      <small className="bl-topping-desc">
                        {option === "PEARL" ? "Dai giòn ngọt thanh thơm lừng" : "Béo ngậy sánh mịn"}
                      </small>
                    </div>
                    <strong className="bl-topping-price">
                      +{toppingPrice[option].toLocaleString("vi-VN")}đ
                    </strong>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Customer Barista Note / Preferences */}
          <fieldset className="bl-custom-group">
            <legend className="bl-custom-legend">
              3. Khẩu vị pha chế <span className="bl-optional">(Ghi chú nhận tại quầy)</span>
            </legend>
            <div className="bl-preference-grid">
              <label className="bl-field-select-wrap">
                <span className="bl-field-label">Lượng đá:</span>
                <select
                  value={iceLevel}
                  onChange={(e) => setIceLevel(e.target.value)}
                  className="bl-select"
                >
                  <option value="100">100% đá (Chuẩn vị mát lạnh)</option>
                  <option value="50">50% đá (Ít đá)</option>
                  <option value="0">Không đá</option>
                </select>
              </label>

              <label className="bl-field-select-wrap">
                <span className="bl-field-label">Độ ngọt:</span>
                <select
                  value={sweetLevel}
                  onChange={(e) => setSweetLevel(e.target.value)}
                  className="bl-select"
                >
                  <option value="100">100% đường (Chuẩn vị ngọt)</option>
                  <option value="50">50% đường (Ít ngọt thanh dịu)</option>
                  <option value="0">Không thêm đường</option>
                </select>
              </label>
            </div>
          </fieldset>

          {/* Quantity and Desktop Price Breakdown */}
          <div className="bl-detail-purchase-box">
            <div className="bl-quantity-row">
              <span className="bl-field-label">Số lượng:</span>
              <div className="bl-quantity-stepper bl-stepper-lg" role="group" aria-label="Số lượng ly">
                <button
                  type="button"
                  className="bl-stepper-btn"
                  disabled={quantity <= 1 || isSoldOut}
                  onClick={() => handleQuantityChange(-1)}
                  aria-label="Giảm 1 ly"
                >
                  <MinusIcon size={18} />
                </button>
                <span className="bl-stepper-val" aria-label={`Số ly: ${quantity}`}>
                  {quantity}
                </span>
                <button
                  type="button"
                  className="bl-stepper-btn"
                  disabled={quantity >= Math.min(99, stock) || isSoldOut}
                  onClick={() => handleQuantityChange(1)}
                  aria-label="Tăng 1 ly"
                >
                  <PlusIcon size={18} />
                </button>
              </div>
            </div>

            <div className="bl-price-calc-box">
              <div className="bl-calc-line">
                <span>Đơn giá tùy chọn ({quantity} ly):</span>
                <strong>{money(totalPrice)}</strong>
              </div>
            </div>

            {error && (
              <p className="bl-alert bl-alert-error" role="alert">
                <ExclamationIcon size={16} /> {error}
              </p>
            )}

            <div className="bl-actions bl-desktop-actions">
              <button
                className="bl-button bl-button-primary bl-btn-add-main"
                type="button"
                disabled={!cart.ready || isSoldOut}
                onClick={handleAddToCart}
              >
                <ShoppingBagIcon size={20} />
                <span>Thêm vào giỏ ({money(totalPrice)})</span>
              </button>
              <Link href="/cart" className="bl-button bl-button-secondary">
                Xem giỏ hàng
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Sticky Bottom Bar */}
      <div className="bl-mobile-bottom-bar" aria-label="Thanh đặt hàng nhanh">
        <div className="bl-mobile-bottom-inner">
          <div className="bl-mobile-price-group">
            <span className="bl-mobile-price-label">Tổng ({quantity} ly):</span>
            <strong className="bl-mobile-price-val">{money(totalPrice)}</strong>
          </div>
          <button
            type="button"
            className="bl-button bl-button-primary bl-mobile-btn-add"
            disabled={!cart.ready || isSoldOut}
            onClick={handleAddToCart}
          >
            <ShoppingBagIcon size={18} />
            <span>Thêm giỏ</span>
          </button>
        </div>
      </div>
    </main>
  );
}
