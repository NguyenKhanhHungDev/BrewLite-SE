"use client";

import React from "react";
import Link from "next/link";
import type { Product } from "@/lib/products";
import ProductImage from "./ProductImage";
import { useCart } from "./CartProvider";
import { useToast } from "./Toast";
import { PlusIcon, ExclamationIcon } from "./Icons";

export default function ProductCard({ product }: { product: Product }) {
  const cart = useCart();
  const toast = useToast();

  const maxStock = product.stockBySize
    ? Math.max(...Object.values(product.stockBySize))
    : product.stock;
  const isSoldOut = maxStock === 0;

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isSoldOut || !cart.ready) return;

    try {
      cart.add(product, "M", [], 1);
      toast.success(`Đã thêm ${product.name}.`);
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
