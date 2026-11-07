"use client";

import { useState } from "react";
import type { Product } from "@/lib/products";
import { categories, normalizeSearch } from "@/lib/menu";
import ProductCard from "./ProductCard";

export type MenuState =
  | { status: "loading" }
  | { status: "success"; products: Product[] }
  | { status: "error" };

export default function MenuList({
  state,
  onRetry,
}: {
  state: MenuState;
  onRetry: () => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const keyword = normalizeSearch(search);
  const products =
    state.status === "success"
      ? state.products.filter(
          (product) =>
            normalizeSearch(product.name).includes(keyword) &&
            (!category || product.category === category),
        )
      : [];
  return (
    <section
      className="bl-menu-section"
      id="menu"
      aria-labelledby="menu-heading"
      aria-busy={state.status === "loading"}
    >
      <div className="bl-section-heading">
        <div>
          <span className="bl-eyebrow">BrewLite drinks</span>
          <h2 id="menu-heading">Find your favorite</h2>
        </div>
        {state.status === "success" && state.products.length > 0 && (
          <p role="status">{products.length} đồ uống</p>
        )}
      </div>
      <div className="bl-menu-filters">
        <label>
          Tìm món
          <input
            type="search"
            placeholder="Nhập tên đồ uống"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          Danh mục
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Tất cả</option>
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {search && (
          <button
            className="bl-text-button"
            type="button"
            onClick={() => setSearch("")}
          >
            Xóa tìm kiếm
          </button>
        )}
      </div>
      {state.status === "loading" && (
        <>
          <p className="bl-loading-text" role="status">
            Đang tải sản phẩm...
          </p>
          <div className="bl-product-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="bl-skeleton" key={index}>
                <div />
                <span />
                <span />
              </div>
            ))}
          </div>
        </>
      )}
      {state.status === "error" && (
        <div className="bl-menu-state" role="alert">
          <span className="bl-state-symbol" aria-hidden="true">
            !
          </span>
          <h3>Không lấy được sản phẩm</h3>
          <p>Không tải được menu. Vui lòng thử lại.</p>
          <button className="bl-button" type="button" onClick={onRetry}>
            Thử lại <span aria-hidden="true">↻</span>
          </button>
        </div>
      )}
      {state.status === "success" && state.products.length === 0 && (
        <div className="bl-menu-state" role="status">
          <span className="bl-state-symbol" aria-hidden="true">
            ∅
          </span>
          <h3>Chưa có sản phẩm</h3>
          <p>Thực đơn sẽ hiển thị tại đây khi có sản phẩm.</p>
        </div>
      )}
      {state.status === "success" &&
        state.products.length > 0 &&
        (products.length ? (
          <ul className="bl-product-grid">
            {products.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="bl-menu-state" role="status">
            <h3>Không tìm thấy đồ uống</h3>
            <p>Thử tên món khác hoặc đổi danh mục.</p>
            <button
              className="bl-button bl-button-secondary"
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("");
              }}
            >
              Xóa bộ lọc
            </button>
          </div>
        ))}
    </section>
  );
}
