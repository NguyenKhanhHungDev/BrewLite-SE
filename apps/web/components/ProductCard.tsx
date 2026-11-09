"use client";

import React from "react";
import Link from "next/link";
import type { Product } from "@/lib/products";
import ProductImage from "./ProductImage";
import { useCart } from "./CartProvider";
import { useToast } from "./Toast";
import { PlusIcon, FireIcon, SparklesIcon, ExclamationIcon } from "./Icons";

// Helper tags based on actual product catalog
function getProductBadge(product: Product): { label: string; icon: React.ReactNode; type: "hot" | "new" } | null {
  const name = product.name.toLowerCase();
  if (name.includes("cà phê sữa") || name.includes("bạc xỉu") || name.includes("trà đào")) {
    return { label: "Bán chạy", icon: <FireIcon size={13} />, type: "hot" };
  }
  if (name.includes("muối") || name.includes("matcha")) {
    return { label: "Mới ra mắt", icon: <SparklesIcon size={13} />, type: "new" };
  }
  return null;
}

export default function ProductCard({ product }: { product: Product }) {
  const cart = useCart();
  const toast = useToast();

  const maxStock = product.stockBySize
    ? Math.max(...Object.values(product.stockBySize))
    : product.stock;
  const isSoldOut = maxStock === 0;
  const badge = !isSoldOut ? getProductBadge(product) : null;

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isSoldOut || !cart.ready) return;

    try {
      cart.add(product, "M", [], 1);
      toast.success(`Đã thêm 1 ly ${product.name} (Size M) vào giỏ.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chưa thể thêm vào giỏ.");
    }
  }

  return (
    <article
      className={`bl-product-card ${isSoldOut ? "bl-product-soldout" : ""}`}
      tabIndex={0}
      aria-label={`${product.name}, giá ${product.price.toLocaleString("vi-VN")} đồng${isSoldOut ? ", hiện đã hết hàng" : ""}`}
    >
      <Link
        href={`/products/${product.id}`}
        className="bl-product-image-wrap"
        tabIndex={-1}
        aria-hidden="true"
      >
        <ProductImage src={product.imageUrl} name={product.name} />

        {isSoldOut ? (
          <div className="bl-soldout-overlay">
            <span className="bl-soldout-badge">
              <ExclamationIcon size={16} /> Tạm hết nguyên liệu
            </span>
          </div>
        ) : badge ? (
          <span className={`bl-product-tag bl-tag-${badge.type}`}>
            {badge.icon} {badge.label}
          </span>
        ) : null}
      </Link>

      <div className="bl-product-info">
        <div className="bl-product-title-row">
          <h3 className="bl-product-title">
            <Link href={`/products/${product.id}`} className="bl-product-title-link">
              {product.name}
            </Link>
          </h3>
        </div>

        <div className="bl-product-meta">
          <p className="bl-product-price">
            {product.price.toLocaleString("vi-VN")} <span className="bl-price-unit">VND</span>
          </p>
          {!isSoldOut && (
            <span className="bl-stock-hint">
              {maxStock < 10 ? `Chỉ còn ${maxStock} ly` : "Sẵn sàng pha"}
            </span>
          )}
        </div>

        <div className="bl-product-actions">
          <Link
            href={`/products/${product.id}`}
            className="bl-button bl-button-secondary bl-btn-detail"
            aria-label={`Tùy chọn cho ${product.name}`}
          >
            Tùy chọn
          </Link>
          <button
            type="button"
            className="bl-button bl-button-primary bl-btn-quick-add"
            disabled={isSoldOut || !cart.ready}
            onClick={handleQuickAdd}
            aria-label={
              isSoldOut
                ? `${product.name} tạm hết hàng`
                : `Thêm nhanh 1 ly ${product.name} size M vào giỏ`
            }
          >
            {!isSoldOut && <PlusIcon size={18} />}
            <span className="bl-btn-text">{isSoldOut ? "Tạm hết" : "Thêm nhanh"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
