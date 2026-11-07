import React from "react";
import type { Product } from "@/lib/products";
import Link from "next/link";
import ProductImage from "./ProductImage";
import { ArrowRightIcon, SparklesIcon, CoffeeIcon, ClockIcon } from "./Icons";

export default function MenuHero({ product }: { product?: Product }) {
  return (
    <section className="bl-hero" aria-labelledby="hero-heading">
      <div className="bl-hero-content">
        <div className="bl-hero-badge">
          <SparklesIcon size={16} className="bl-badge-icon" />
          <span>Thủ công & Rang mộc nguyên bản • Nhận nhanh tại quầy</span>
        </div>

        <h1 id="hero-heading">
          Chắt lọc từng giọt đậm đà,
          <br />
          <em>đánh thức trọn vẹn vị giác.</em>
        </h1>

        <p>
          Mỗi ly đồ uống tại BrewLite là sự hòa quyện giữa hạt cà phê cao nguyên tuyển chọn cùng công thức pha chế thủ công tỉ mỉ, sẵn sàng phục vụ bạn ngay khi đến quầy.
        </p>

        <div className="bl-hero-actions">
          <a className="bl-button bl-button-primary bl-hero-cta" href="#menu">
            <span>Đặt món ngay</span>
            <ArrowRightIcon size={18} />
          </a>
          <a className="bl-button bl-button-ghost" href="#highlights">
            <span>Món gợi ý hôm nay</span>
          </a>
        </div>

        <div className="bl-hero-features" aria-label="Đặc điểm phục vụ">
          <div className="bl-hero-feat-item">
            <div className="bl-feat-icon-wrap" aria-hidden="true">
              <CoffeeIcon size={18} />
            </div>
            <div>
              <strong>Hương vị mộc</strong>
              <small>Robusta & Arabica đậm chất</small>
            </div>
          </div>
          <div className="bl-hero-feat-item">
            <div className="bl-feat-icon-wrap" aria-hidden="true">
              <ClockIcon size={18} />
            </div>
            <div>
              <strong>Tiết kiệm thời gian</strong>
              <small>Nhận tại quầy không chờ đợi</small>
            </div>
          </div>
        </div>
      </div>

      <div className="bl-hero-visual">
        <div className="bl-steam-container" aria-hidden="true">
          <span className="bl-steam-line bl-steam-1" />
          <span className="bl-steam-line bl-steam-2" />
          <span className="bl-steam-line bl-steam-3" />
        </div>

        {product ? (
          <Link
            href={`/products/${product.id}`}
            className="bl-hero-product-link"
            aria-label={`Khám phá món đặc trưng: ${product.name}`}
          >
            <div className="bl-hero-image-wrap">
              <ProductImage src={product.imageUrl} name={product.name} hero />
            </div>
            <div className="bl-hero-note">
              <span className="bl-hero-note-badge" aria-hidden="true">
                <SparklesIcon size={16} />
              </span>
              <div>
                <small>Món nổi bật hôm nay</small>
                <strong>{product.name}</strong>
                <span className="bl-hero-note-price">
                  {product.price.toLocaleString("vi-VN")} VND
                </span>
              </div>
            </div>
          </Link>
        ) : (
          <div className="bl-hero-decoration" aria-hidden="true">
            <span className="bl-decoration-ring" />
            <svg viewBox="0 0 240 240" fill="none">
              <path
                d="M66 98h108v39a47 47 0 0 1-47 47h-14a47 47 0 0 1-47-47V98Z"
                fill="currentColor"
              />
              <path
                d="M174 108h10a24 24 0 1 1 0 48h-13"
                stroke="currentColor"
                strokeWidth="9"
              />
            </svg>
          </div>
        )}
      </div>
    </section>
  );
}
