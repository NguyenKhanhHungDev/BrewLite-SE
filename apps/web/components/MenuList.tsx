"use client";

import React, { useMemo, useState, useEffect } from "react";
import type { Product } from "@/lib/products";
import { normalizeSearch } from "@/lib/menu";
import ProductCard from "./ProductCard";
import {
  SearchIcon,
  CloseIcon,
  CoffeeIcon,
  TeaIcon,
  SparklesIcon,
  FireIcon,
  SunIcon,
  SunsetIcon,
  MoonIcon,
  RefreshIcon,
} from "./Icons";

export type MenuState =
  | { status: "loading" }
  | { status: "success"; products: Product[] }
  | { status: "error" };

type CategoryKey = "all" | "coffee" | "tea" | "special" | "bestseller" | "time_of_day";

function getTimeOfDay(): { key: "morning" | "afternoon" | "evening"; title: string; subtitle: string; icon: React.ReactNode } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return {
      key: "morning",
      title: "Gợi ý buổi sáng",
      subtitle: "Đậm vị caffeine, khởi đầu ngày mới tỉnh táo",
      icon: <SunIcon size={18} />,
    };
  }
  if (hour >= 12 && hour < 18) {
    return {
      key: "afternoon",
      title: "Gợi ý buổi chiều",
      subtitle: "Thanh mát giải nhiệt, xua tan căng thẳng",
      icon: <SunsetIcon size={18} />,
    };
  }
  return {
    key: "evening",
    title: "Gợi ý buổi tối",
    subtitle: "Ngọt ngào, êm dịu, trọn vẹn thư giãn",
    icon: <MoonIcon size={18} />,
  };
}

export default function MenuList({
  state,
  onRetry,
}: {
  state: MenuState;
  onRetry: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");

  const [timeOfDay, setTimeOfDay] = useState<ReturnType<typeof getTimeOfDay> | null>(null);

  useEffect(() => {
    // Read the browser's clock after hydration, never during static prerendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeOfDay(getTimeOfDay());
  }, []);

  // Debounce for search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const allProducts = useMemo(
    () => (state.status === "success" ? state.products : []),
    [state],
  );

  // Filter products based on search & category
  const filteredProducts = useMemo(() => {
    if (!allProducts.length) return [];

    const normalizedQuery = normalizeSearch(debouncedQuery);

    return allProducts.filter((product) => {
      const normalizedName = normalizeSearch(product.name);
      const name = product.name.toLowerCase();

      // Search match
      if (normalizedQuery && !normalizedName.includes(normalizedQuery)) {
        return false;
      }

      // Category filter
      if (activeCategory === "coffee") {
        return (
          product.category === "COFFEE" ||
          name.includes("cà phê") ||
          name.includes("bạc xỉu")
        );
      }
      if (activeCategory === "tea") {
        return (
          product.category === "TEA" ||
          (name.includes("trà") && !name.includes("cà phê"))
        );
      }
      if (activeCategory === "special") {
        return (
          product.category === "OTHER" ||
          name.includes("matcha") ||
          name.includes("cacao") ||
          name.includes("muối")
        );
      }
      if (activeCategory === "bestseller") {
        return (
          name.includes("cà phê sữa") ||
          name.includes("bạc xỉu") ||
          name.includes("trà đào")
        );
      }
      if (activeCategory === "time_of_day") {
        if (timeOfDay?.key === "morning") {
          return (
            product.category === "COFFEE" ||
            name.includes("cà phê") ||
            name.includes("bạc xỉu")
          );
        }
        if (timeOfDay?.key === "afternoon") {
          return (
            name.includes("trà đào") ||
            name.includes("trà vải") ||
            name.includes("trà chanh")
          );
        }
        return (
          name.includes("matcha") ||
          name.includes("cacao") ||
          name.includes("trà sữa")
        );
      }

      return true;
    });
  }, [allProducts, debouncedQuery, activeCategory, timeOfDay?.key]);

  return (
    <section className="bl-menu-section" id="menu" aria-labelledby="menu-heading">
      {/* Search and Category Navigation */}
      <div className="bl-menu-nav-wrap">
        <div className="bl-section-heading">
          <div>
            <span className="bl-eyebrow">Thực đơn BrewLite</span>
            <h2 id="menu-heading">Chọn thức uống bạn yêu thích</h2>
          </div>
          {state.status === "success" && (
            <p className="bl-menu-count">
              Hiển thị <strong>{filteredProducts.length}</strong> / {allProducts.length} món
            </p>
          )}
        </div>

        {/* Search Bar */}
        <div className="bl-search-bar" role="search">
          <div className="bl-search-input-wrap">
            <SearchIcon size={19} className="bl-search-icon" />
            <input
              type="text"
              className="bl-search-input"
              placeholder="Tìm theo tên món (cà phê sữa, trà đào, bạc xỉu...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Tìm kiếm thức uống"
            />
            {searchQuery && (
              <button
                type="button"
                className="bl-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Xóa tìm kiếm"
              >
                <CloseIcon size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="bl-category-chips" role="tablist" aria-label="Bộ lọc danh mục đồ uống">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "all"}
            className={`bl-chip ${activeCategory === "all" ? "bl-chip-active" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            <span>Tất cả</span>
            <span className="bl-chip-badge">{allProducts.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "bestseller"}
            className={`bl-chip ${activeCategory === "bestseller" ? "bl-chip-active" : ""}`}
            onClick={() => setActiveCategory("bestseller")}
          >
            <FireIcon size={16} />
            <span>Bán chạy</span>
          </button>

          <button
            type="button"
            role="tab"
            disabled={!timeOfDay}
            aria-selected={activeCategory === "time_of_day"}
            className={`bl-chip ${activeCategory === "time_of_day" ? "bl-chip-active" : ""}`}
            onClick={() => setActiveCategory("time_of_day")}
          >
            {timeOfDay?.icon ?? <SunIcon size={18} />}
            <span>{timeOfDay?.title ?? "Gợi ý theo thời gian"}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "coffee"}
            className={`bl-chip ${activeCategory === "coffee" ? "bl-chip-active" : ""}`}
            onClick={() => setActiveCategory("coffee")}
          >
            <CoffeeIcon size={16} />
            <span>Cà phê truyền thống</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "tea"}
            className={`bl-chip ${activeCategory === "tea" ? "bl-chip-active" : ""}`}
            onClick={() => setActiveCategory("tea")}
          >
            <TeaIcon size={16} />
            <span>Trà trái cây & Trà sữa</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "special"}
            className={`bl-chip ${activeCategory === "special" ? "bl-chip-active" : ""}`}
            onClick={() => setActiveCategory("special")}
          >
            <SparklesIcon size={16} />
            <span>Món sáng tạo</span>
          </button>
        </div>
      </div>

      {/* Main Product Grid or States */}
      <div className="bl-menu-grid-wrap" aria-live="polite">
        {state.status === "loading" && (
          <div className="bl-loading-container">
            <p className="bl-loading-text" role="status">
              Đang chuẩn bị thực đơn pha chế...
            </p>
            <div className="bl-product-grid" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <div className="bl-skeleton-card" key={index}>
                  <div className="bl-skeleton-image shimmer" />
                  <div className="bl-skeleton-content">
                    <div className="bl-skeleton-line shimmer bl-sk-title" />
                    <div className="bl-skeleton-line shimmer bl-sk-price" />
                    <div className="bl-skeleton-btn shimmer" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {state.status === "error" && (
          <div className="bl-menu-state bl-menu-state-error" role="alert">
            <div className="bl-state-symbol">
              <RefreshIcon size={24} />
            </div>
            <h3>Không thể tải thực đơn</h3>
            <p>Đã xảy ra sự cố khi kết nối tới trạm pha chế. Bạn hãy thử tải lại nhé.</p>
            <button className="bl-button bl-button-primary" type="button" onClick={onRetry}>
              <span>Thử lại</span>
              <RefreshIcon size={16} />
            </button>
          </div>
        )}

        {state.status === "success" && allProducts.length === 0 && (
          <div className="bl-menu-state" role="status">
            <div className="bl-state-symbol">
              <CoffeeIcon size={24} />
            </div>
            <h3>Thực đơn đang được cập nhật</h3>
            <p>Quầy pha chế đang chuẩn bị các mẻ đồ uống tươi mới. Vui lòng quay lại sau ít phút.</p>
          </div>
        )}

        {state.status === "success" && allProducts.length > 0 && filteredProducts.length === 0 && (
          <div className="bl-menu-state bl-empty-search" role="status">
            <div className="bl-state-symbol">
              <SearchIcon size={24} />
            </div>
            <h3>Không tìm thấy món phù hợp</h3>
            <p>
              Không có món nào khớp với từ khóa <strong>&ldquo;{searchQuery}&rdquo;</strong> trong danh mục này.
            </p>
            <button
              className="bl-button bl-button-secondary"
              type="button"
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("all");
              }}
            >
              Xem toàn bộ thực đơn
            </button>
          </div>
        )}

        {state.status === "success" && filteredProducts.length > 0 && (
          <ul className="bl-product-grid" aria-label="Danh sách món trong thực đơn">
            {filteredProducts.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
