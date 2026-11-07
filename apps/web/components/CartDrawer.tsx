"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { useToast } from "./Toast";
import ProductImage from "./ProductImage";
import { money, optionText, unitPrice } from "@/lib/pricing";
import { cartTotal } from "@/lib/cart";
import { CloseIcon, PlusIcon, MinusIcon, TrashIcon, ShoppingBagIcon, ArrowRightIcon } from "./Icons";

export default function CartDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { lines, ready, changeQuantity, remove, add } = useCart();
  const toast = useToast();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const total = ready && lines.length ? cartTotal(lines) : 0;
  const count = lines.reduce((sum, item) => sum + item.quantity, 0);

  function handleRemove(line: (typeof lines)[0]) {
    remove(line.key);
    toast.undo(`Đã xóa ${line.product.name} (${line.size}) khỏi giỏ.`, () => {
      add(line.product, line.size, line.toppings, line.quantity);
    });
  }

  return (
    <div className="bl-drawer-overlay" onClick={onClose} aria-hidden={!isOpen}>
      <aside
        className="bl-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Giỏ hàng của bạn"
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bl-drawer-header">
          <div className="bl-drawer-title-group">
            <ShoppingBagIcon size={22} className="bl-drawer-title-icon" />
            <h2 className="bl-drawer-title">Giỏ hàng của bạn</h2>
            <span className="bl-drawer-count">{count} ly</span>
          </div>
          <button
            type="button"
            className="bl-drawer-close"
            onClick={onClose}
            aria-label="Đóng giỏ hàng"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="bl-drawer-body">
          {!lines.length ? (
            <div className="bl-drawer-empty">
              <div className="bl-drawer-empty-icon" aria-hidden="true">
                <ShoppingBagIcon size={44} strokeWidth={1.4} />
              </div>
              <h3>Giỏ hàng đang trống</h3>
              <p>Hãy chọn cho mình một ly cà phê thơm lừng để tiếp thêm năng lượng nhé.</p>
              <button
                type="button"
                className="bl-button"
                onClick={() => {
                  onClose();
                  const menuEl = document.getElementById("menu");
                  if (menuEl) menuEl.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Khám phá thực đơn
              </button>
            </div>
          ) : (
            <div className="bl-drawer-lines">
              {lines.map((line) => {
                const itemPrice = unitPrice(line.product.price, line.size, line.toppings);
                const lineTotal = itemPrice * line.quantity;
                return (
                  <article className="bl-drawer-line" key={line.key}>
                    <div className="bl-drawer-image">
                      <ProductImage src={line.product.imageUrl} name={line.product.name} />
                    </div>
                    <div className="bl-drawer-content">
                      <div className="bl-drawer-line-top">
                        <h3 className="bl-drawer-name">{line.product.name}</h3>
                        <button
                          type="button"
                          className="bl-drawer-remove"
                          onClick={() => handleRemove(line)}
                          aria-label={`Xóa ${line.product.name} ${line.size}`}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                      <p className="bl-drawer-options">
                        {optionText(line.size, line.toppings)}
                      </p>
                      <div className="bl-drawer-line-bottom">
                        <div className="bl-quantity-stepper" role="group" aria-label="Chỉnh số lượng">
                          <button
                            type="button"
                            className="bl-stepper-btn"
                            disabled={line.quantity <= 1}
                            onClick={() => changeQuantity(line.key, line.quantity - 1)}
                            aria-label={`Giảm số ly ${line.product.name}`}
                          >
                            <MinusIcon size={16} />
                          </button>
                          <span className="bl-stepper-val" aria-label="Số lượng">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            className="bl-stepper-btn"
                            onClick={() => changeQuantity(line.key, line.quantity + 1)}
                            aria-label={`Tăng số ly ${line.product.name}`}
                          >
                            <PlusIcon size={16} />
                          </button>
                        </div>
                        <span className="bl-drawer-line-price">{money(lineTotal)}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="bl-drawer-footer">
            <div className="bl-drawer-summary-row">
              <span>Tạm tính ({count} ly)</span>
              <strong>{money(total)}</strong>
            </div>
            <p className="bl-drawer-note">Đã bao gồm thuế & chuẩn bị nhận tại quầy.</p>
            <div className="bl-drawer-actions">
              <Link
                href="/checkout"
                className="bl-button bl-button-primary bl-full"
                onClick={onClose}
              >
                <span>Đặt món ngay</span>
                <ArrowRightIcon size={18} />
              </Link>
              <Link
                href="/cart"
                className="bl-button bl-button-secondary bl-full"
                onClick={onClose}
              >
                Xem chi tiết giỏ hàng
              </Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
