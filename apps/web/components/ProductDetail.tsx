"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProductImage from "./ProductImage";
import {
  parseProduct,
  type Product,
} from "@/lib/products";
import {
  money,
  sizeDelta,
  sizePrice,
  sizeNames,
  toppingNames,
  toppingPrice,
  unitPrice,
  type Size,
  type Topping,
} from "@/lib/pricing";
import { ApiError, requestJson } from "@/lib/api";
import { cartKey } from "@/lib/cart";
import { useCart } from "./CartProvider";
import {
  iceOptions,
  sugarOptions,
  MAX_NOTE_LENGTH,
  type IceLevel,
  type SugarLevel,
} from "@/lib/preferences";
import { useToast } from "./Toast";
import {
  ArrowLeftIcon,
  PlusIcon,
  MinusIcon,
  ExclamationIcon,
  ShoppingBagIcon,
  SparklesIcon,
} from "./Icons";

type ProductState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "not-found" }
  | { status: "ready"; product: Product };

function getStockBadge(stock: number) {
  if (stock <= 0) {
    return { label: "Hết hàng", cls: "bl-badge-out" };
  }
  if (stock <= 5) {
    return { label: `Sắp hết (còn ${stock} ly)`, cls: "bl-badge-low" };
  }
  return { label: "Còn hàng", cls: "bl-badge-in" };
}

export default function ProductDetail({ id: propId }: { id?: string } = {}) {
  const params = useParams();
  const id = propId ?? (params?.id as string);

  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ProductState>({ status: "loading" });
  const [size, setSize] = useState<Size>("M");
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [sugarLevel, setSugarLevel] = useState<SugarLevel>(100);
  const [iceLevel, setIceLevel] = useState<IceLevel>("NORMAL");
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const cart = useCart();
  const toast = useToast();

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    requestJson(`/api/products/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then((raw) => {
        if (controller.signal.aborted) return;
        const product = parseProduct(raw);
        const sizes: Size[] = ["M", "L", "S"];
        const valid = sizes.filter((value) => sizePrice(product.price, value) !== null);
        setSize(valid.find((value) => (product.stockBySize?.[value] ?? product.stock) > 0) ?? valid[0] ?? "M");
        setQuantity(1);
        setError("");
        setState({ status: "ready", product });
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setState({ status: cause instanceof ApiError && cause.status === 404 ? "not-found" : "error" });
        }
      });

    return () => controller.abort();
  }, [id, attempt]);

  if (state.status === "loading") {
    return (
      <main className="bl-flow-wrap">
        <div className="bl-menu-state" role="status">
          <span className="bl-spinner-dot" />
          <p>Đang chuẩn bị thông tin thức uống...</p>
        </div>
      </main>
    );
  }

  if (state.status === "not-found") {
    return (
      <main className="bl-flow-wrap">
        <section className="bl-panel bl-empty">
          <div className="bl-empty-cart-visual" aria-hidden="true">
            <ShoppingBagIcon size={48} />
          </div>
          <h2>Không tìm thấy món</h2>
          <p>Món bạn tìm có thể đã ngừng phục vụ hoặc không tồn tại trong thực đơn.</p>
          <Link href="/" className="bl-button bl-button-primary">
            Quay về thực đơn
          </Link>
        </section>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="bl-flow-wrap">
        <section className="bl-panel bl-empty">
          <div className="bl-empty-cart-visual" aria-hidden="true">
            <ExclamationIcon size={48} />
          </div>
          <h2>Không tải được sản phẩm</h2>
          <p>Có lỗi xảy ra khi tải dữ liệu. Vui lòng tải lại trang hoặc kiểm tra kết nối mạng.</p>
          <button type="button" className="bl-button bl-button-primary" onClick={() => { setState({ status: "loading" }); setAttempt((value) => value + 1); }}>Thử lại</button>
          <Link href="/" className="bl-button bl-button-secondary">
            Về trang chủ
          </Link>
        </section>
      </main>
    );
  }

  const { product } = state;
  const stock = product.stockBySize?.[size] ?? product.stock;
  const validPrice = sizePrice(product.price, size) !== null;
  const usedStock = cart.lines.filter((line) => line.product.id === product.id && line.size === size).reduce((sum, line) => sum + line.quantity, 0);
  const key = cartKey(product.id, size, toppings, { sugarLevel, iceLevel, note });
  const existingQuantity = cart.lines.find((line) => line.key === key)?.quantity ?? 0;
  const maxAdd = Math.max(0, Math.min(99 - existingQuantity, stock - usedStock));
  const isSoldOut = stock <= 0 || !validPrice;

  function handleQuantityChange(delta: number) {
    const next = quantity + delta;
    if (next >= 1 && (delta < 0 || next <= maxAdd)) {
      setQuantity(next);
      setError("");
    }
  }

  function toggleTopping(topping: Topping) {
    setToppings((prev) =>
      prev.includes(topping) ? prev.filter((t) => t !== topping) : [...prev, topping],
    );
  }

  const singlePrice = validPrice ? unitPrice(product.price, size, toppings) : 0;
  const totalPrice = singlePrice * quantity;
  const stockBadge = getStockBadge(stock);

  function handleAddToCart() {
    setError("");
    if (!cart.ready) {
      setError("Đang khôi phục giỏ hàng, vui lòng chờ.");
      return;
    }
    if (isSoldOut) {
      setError("Món này kích cỡ này hiện đã hết hàng.");
      return;
    }
    if (quantity > maxAdd) {
      setError(`Có thể thêm tối đa ${maxAdd} ly cho lựa chọn này.`);
      return;
    }

    try {
      cart.add(product, size, toppings, quantity, { sugarLevel, iceLevel, note });
      toast.success(`Đã thêm ${quantity} ly ${product.name} vào giỏ hàng!`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể thêm vào giỏ hàng.");
    }
  }

  return (
    <main className="bl-flow-wrap bl-detail-page">
      {/* Back button */}
      <nav aria-label="Đường dẫn trang">
        <Link href="/" className="bl-detail-back">
          <ArrowLeftIcon size={18} />
          <span>Quay lại thực đơn</span>
        </Link>
      </nav>

      <section className="bl-detail-layout" aria-labelledby="product-name">
        {/* Left Column: Image with badges */}
        <div className="bl-detail-visual">
          <div className="bl-detail-image-box">
            <ProductImage src={product.imageUrl} name={product.name} hero />
            <div className="bl-detail-image-badges">
              <span className={`bl-badge-stock ${stockBadge.cls}`}>
                {stockBadge.label}
              </span>
              <span className="bl-badge-artisan">
                <SparklesIcon size={14} /> Pha chế thủ công
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Customization & Add to Cart */}
        <div className="bl-detail-info">
          <div className="bl-detail-header">
            <span className="bl-eyebrow">BrewLite Special Selection</span>
            <h1 id="product-name">{product.name}</h1>
            <p className="bl-detail-desc">
              Được tuyển chọn từ nguồn hạt Robusta & Arabica Cầu Đất nguyên chất,
              pha chế tỉ mỉ giữ trọn vẹn hương thơm nồng nàn và hậu vị sâu lắng.
            </p>
            <div className="bl-detail-base-price">
              <span className="bl-price-tag">{money(singlePrice)}</span>
              <span className="bl-price-sub">/ ly (cỡ {size})</span>
            </div>
          </div>

          <div className="bl-custom-section">
            {/* Size Selection Group */}
            <fieldset className="bl-custom-group">
              <legend className="bl-custom-legend">
                1. Chọn kích cỡ ly <span className="bl-required">*</span>
              </legend>
              <div className="bl-size-grid" role="radiogroup">
                {(["S", "M", "L"] as const).map((s) => {
                  const sizeStock = product.stockBySize?.[s] ?? product.stock;
                  const isPriceInvalid = sizePrice(product.price, s) === null;
                  const isSizeDisabled = sizeStock <= 0 || isPriceInvalid;
                  const isSelected = size === s;

                  return (
                    <label
                      key={s}
                      className={`bl-size-card ${isSelected ? "bl-size-card-active" : ""} ${isSizeDisabled ? "bl-size-card-disabled" : ""}`}
                    >
                      <input
                        type="radio"
                        name="product-size"
                        value={s}
                        checked={isSelected}
                        disabled={isSizeDisabled}
                        onChange={() => {
                          setSize(s);
                          if (quantity > sizeStock && sizeStock > 0) setQuantity(sizeStock);
                        }}
                        className="bl-visually-hidden"
                      />
                      <div className="bl-size-top">
                        <strong className="bl-size-code">{s}</strong>
                        {sizeDelta[s] > 0 && (
                          <span className="bl-size-extra">
                            +{sizeDelta[s].toLocaleString("vi-VN")}đ
                          </span>
                        )}
                      </div>
                      <span className="bl-size-label">{sizeNames[s]}</span>
                      <small className="bl-size-stock-hint">
                        {isPriceInvalid ? "Giá chưa hợp lệ" : isSizeDisabled ? "Hết hàng" : `Còn ${sizeStock} ly`}
                      </small>
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
                3. Khẩu vị pha chế <span className="bl-optional">(Tùy chỉnh riêng)</span>
              </legend>
              <div className="bl-preference-grid">
                <label className="bl-field-select-wrap">
                  <span className="bl-field-label">Lượng đường:</span>
                  <select
                    value={sugarLevel ?? 100}
                    onChange={(e) => setSugarLevel(Number(e.target.value) as SugarLevel)}
                    className="bl-select"
                  >
                    {sugarOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bl-field-select-wrap">
                  <span className="bl-field-label">Lượng đá:</span>
                  <select
                    value={iceLevel ?? "NORMAL"}
                    onChange={(e) => setIceLevel(e.target.value as IceLevel)}
                    className="bl-select"
                  >
                    {iceOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="bl-field" style={{ marginTop: "1rem", display: "block" }}>
                <span className="bl-field-label" style={{ display: "block", marginBottom: "0.25rem" }}>
                  Ghi chú cho Barista:
                </span>
                <textarea
                  rows={2}
                  maxLength={MAX_NOTE_LENGTH}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ví dụ: để riêng topping, ít sữa đặc..."
                  className="bl-input"
                  style={{ width: "100%", resize: "vertical" }}
                />
              </label>
              <p className="bl-muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                {note.length}/{MAX_NOTE_LENGTH} ký tự. Khẩu vị không phụ thu thêm phí.
              </p>
            </fieldset>

            {/* Quantity and Desktop Price Breakdown */}
            <div className="bl-detail-purchase-box">
              <div className="bl-quantity-row">
                <span className="bl-field-label">Số lượng:</span>
                <div className="bl-quantity-stepper bl-stepper-lg" role="group" aria-label="Số lượng ly">
                  <button
                    type="button"
                    className="bl-stepper-btn"
                    disabled={!cart.ready || quantity <= 1 || isSoldOut}
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
                    disabled={!cart.ready || quantity >= maxAdd || isSoldOut}
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
                  disabled={!cart.ready || isSoldOut || quantity > maxAdd}
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
            disabled={!cart.ready || isSoldOut || quantity > maxAdd}
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
