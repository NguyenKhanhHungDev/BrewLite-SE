"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Product } from "@/lib/products";
import Link from "next/link";
import ProductImage from "./ProductImage";
import {
  ArrowRightIcon,
  SparklesIcon,
  CoffeeIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SteamWaveIcon,
  FireIcon,
} from "./Icons";
import { sizePrice } from "@/lib/pricing";
import { useCart } from "./CartProvider";
import { useToast } from "./Toast";

export default function MenuHero({
  products,
  product,
}: {
  products?: Product[];
  product?: Product;
}) {
  const { add, ready, lines } = useCart();
  const toast = useToast();

  // Combine either product array or single product
  const items = products && products.length > 0 ? products.slice(0, 6) : product ? [product] : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activeProduct = items[currentIndex];

  // Auto-slide every 4.2 seconds
  useEffect(() => {
    if (items.length <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 4200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items.length, isPaused]);

  function handlePrev() {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }

  function handleNext() {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }

  function handleQuickAdd(e: React.MouseEvent, p: Product) {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (!ready) throw new Error("Đang khôi phục giỏ hàng, vui lòng chờ.");
      add(p, "M", [], 1);
      toast.success(`Đã thêm ${p.name}.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Không thể thêm vào giỏ hàng.");
    }
  }

  const usedStock = activeProduct ? lines.filter((line) => line.product.id === activeProduct.id && line.size === "M").reduce((sum, line) => sum + line.quantity, 0) : 0;
  const quickLine = activeProduct ? lines.find((line) => line.key === `${activeProduct.id}:M:`) : undefined;
  const quickDisabled = !ready || !activeProduct || sizePrice(activeProduct.price, "M") === null || usedStock >= (activeProduct.stockBySize?.M ?? activeProduct.stock) || (quickLine?.quantity ?? 0) >= 99;

  return (
    <section className="bl-hero-section" aria-labelledby="hero-heading">
      <div className="bl-hero-container">
        {/* Left Column: Brand & Value Prop */}
        <div className="bl-hero-content">
          <div className="bl-hero-badge">
            <SparklesIcon size={16} className="bl-badge-icon" />
            <span>Thủ công & Rang mộc nguyên bản • Nhận tại quầy</span>
          </div>

          <h1 id="hero-heading" className="bl-hero-title">
            Chắt lọc từng giọt đậm đà,
            <br />
            <em>đánh thức trọn vẹn vị giác.</em>
          </h1>

          <p className="bl-hero-desc">
            Mỗi ly đồ uống tại BrewLite là sự hòa quyện giữa hạt cà phê cao nguyên tuyển chọn
            cùng công thức pha chế thủ công tỉ mỉ, sẵn sàng phục vụ bạn ngay khi đến quầy.
          </p>

          <div className="bl-hero-actions">
            <a className="bl-button bl-button-primary bl-hero-cta" href="#menu">
              <span>Khám phá thực đơn</span>
              <ArrowRightIcon size={18} />
            </a>
            <a className="bl-button bl-button-ghost" href="#menu">
              <span>Gợi ý theo buổi</span>
            </a>
          </div>

          <div className="bl-hero-features" aria-label="Đặc điểm phục vụ">
            <div className="bl-hero-feat-item">
              <div className="bl-feat-icon-wrap" aria-hidden="true">
                <CoffeeIcon size={18} />
              </div>
              <div>
                <strong>Hương vị mộc nguyên bản</strong>
                <small>Robusta & Arabica đậm chất</small>
              </div>
            </div>
            <div className="bl-hero-feat-item">
              <div className="bl-feat-icon-wrap" aria-hidden="true">
                <ClockIcon size={18} />
              </div>
              <div>
                <strong>Tiết kiệm thời gian</strong>
                <small>Nhận tại quầy nhanh chóng</small>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sliding Featured Products Showcase */}
        <div
          className="bl-hero-showcase-column"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {activeProduct ? (
            <div className="bl-hero-carousel-card">
              {/* Floating Steam Animation */}
              <div className="bl-hero-steam-float" aria-hidden="true">
                <SteamWaveIcon className="bl-steam-wave-svg" />
              </div>

              {/* Tag Header */}
              <div className="bl-carousel-top-bar">
                <span className="bl-carousel-badge">
                  <FireIcon size={14} />
                  <span>Bộ Sưu Tập Tiêu Biểu ({currentIndex + 1}/{items.length})</span>
                </span>
                <span className="bl-carousel-sub-badge">
                  {activeProduct.name.toLowerCase().includes("trà") ? "Thanh mát giải nhiệt" : "Đậm vị thủ công"}
                </span>
              </div>

              {/* Product Visual & Details */}
              <Link
                href={`/products/${activeProduct.id}`}
                className="bl-carousel-link-wrap"
                aria-label={`Khám phá món: ${activeProduct.name}`}
              >
                <div className="bl-carousel-img-container">
                  <ProductImage
                    src={activeProduct.imageUrl}
                    name={activeProduct.name}
                    hero
                  />
                  <div className="bl-carousel-glow" aria-hidden="true" />
                </div>

                <div className="bl-carousel-info">
                  <h3 className="bl-carousel-title">{activeProduct.name}</h3>
                  <div className="bl-carousel-price-row">
                    <span className="bl-carousel-price">
                      {activeProduct.price.toLocaleString("vi-VN")} VND
                    </span>
                    <button
                      type="button"
                      className="bl-carousel-quick-btn"
                      disabled={quickDisabled}
                      onClick={(e) => handleQuickAdd(e, activeProduct)}
                      title={`Thêm ${activeProduct.name} vào giỏ hàng`}
                    >
                      <span>+ Thêm nhanh</span>
                    </button>
                  </div>
                </div>
              </Link>

              {/* Carousel Navigation Controls */}
              {items.length > 1 && (
                <div className="bl-carousel-controls">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="bl-carousel-nav-btn prev"
                    aria-label="Món trước"
                  >
                    <ChevronLeftIcon size={18} />
                  </button>

                  <div className="bl-carousel-dots" role="tablist" aria-label="Danh sách món">
                    {items.map((it, idx) => (
                      <button
                        key={it.id}
                        type="button"
                        role="tab"
                        aria-selected={idx === currentIndex}
                        className={`bl-carousel-dot ${idx === currentIndex ? "active" : ""}`}
                        onClick={() => setCurrentIndex(idx)}
                        aria-label={`Món số ${idx + 1}: ${it.name}`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleNext}
                    className="bl-carousel-nav-btn next"
                    aria-label="Món tiếp theo"
                  >
                    <ChevronRightIcon size={18} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bl-hero-decoration" aria-hidden="true">
              <span className="bl-decoration-ring" />
              <div className="bl-hero-fallback-cup">
                <CoffeeIcon size={64} />
                <p>Khám phá menu đồ uống BrewLite</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ticker / Marquee Ribbon of Specialties */}
      <div className="bl-hero-marquee-wrap" aria-hidden="true">
        <div className="bl-hero-marquee-track">
          <span>☕ Cà phê Muối Biển Đậm Đà</span>
          <span className="bl-marquee-dot">•</span>
          <span>🌿 Trà Đào Cam Sả Tươi Mát</span>
          <span className="bl-marquee-dot">•</span>
          <span>🥛 Bạc Xỉu Sữa Tươi 3 Tầng</span>
          <span className="bl-marquee-dot">•</span>
          <span>🍯 Trà Ô Long Sen Vàng Thơm Bùi</span>
          <span className="bl-marquee-dot">•</span>
          <span>🍵 Matcha Latte Yến Mạch Thơm Dịu</span>
          <span className="bl-marquee-dot">•</span>
          <span>☕ Cold Brew Cam Quế Ủ Lạnh 24h</span>
          <span className="bl-marquee-dot">•</span>
          {/* Duplicate for seamless infinite loop */}
          <span>☕ Cà phê Muối Biển Đậm Đà</span>
          <span className="bl-marquee-dot">•</span>
          <span>🌿 Trà Đào Cam Sả Tươi Mát</span>
          <span className="bl-marquee-dot">•</span>
          <span>🥛 Bạc Xỉu Sữa Tươi 3 Tầng</span>
          <span className="bl-marquee-dot">•</span>
          <span>🍯 Trà Ô Long Sen Vàng Thơm Bùi</span>
          <span className="bl-marquee-dot">•</span>
          <span>🍵 Matcha Latte Yến Mạch Thơm Dịu</span>
          <span className="bl-marquee-dot">•</span>
          <span>☕ Cold Brew Cam Quế Ủ Lạnh 24h</span>
          <span className="bl-marquee-dot">•</span>
        </div>
      </div>

      {/* Multi-layered Animated Fluid Waves Divider ("Lượn sóng sống động") */}
      <div className="bl-hero-wave-container" aria-hidden="true">
        <svg
          className="bl-hero-wave-svg"
          viewBox="0 0 1440 180"
          preserveAspectRatio="none"
          fill="none"
        >
          {/* Wave Layer 1: Warm Caramel Semi-transparent */}
          <path
            className="bl-wave-path bl-wave-1"
            d="M0,45 C240,110 480,-20 720,50 C960,120 1200,10 1440,60 L1440,180 L0,180 Z"
            fill="var(--bl-caramel-light)"
            opacity="0.35"
          />
          {/* Wave Layer 2: Cream/Espresso Foam opposing */}
          <path
            className="bl-wave-path bl-wave-2"
            d="M0,75 C320,15 640,115 960,40 C1180,-10 1340,85 1440,70 L1440,180 L0,180 Z"
            fill="var(--bl-sand)"
            opacity="0.65"
          />
          {/* Wave Layer 3: Solid background transition */}
          <path
            className="bl-wave-path bl-wave-3"
            d="M0,95 C360,140 720,60 1080,110 C1260,135 1380,80 1440,95 L1440,180 L0,180 Z"
            fill="var(--bl-bg)"
          />
        </svg>
      </div>
    </section>
  );
}
