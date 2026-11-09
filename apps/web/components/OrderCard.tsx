"use client";

import { useState } from "react";
import Link from "next/link";
import { paidStatuses, statusNames, type OrderRecord } from "@/lib/orders";
import { money, optionText } from "@/lib/pricing";
import { useCart } from "./CartProvider";
import { useToast } from "./Toast";
import OrderTimeline from "./OrderTimeline";
import ItemPreferences from "./ItemPreferences";
import { parseProducts } from "@/lib/products";
import { RefreshIcon, ArrowRightIcon } from "./Icons";

export default function OrderCard({
  order,
  adminView = false,
}: {
  order: OrderRecord;
  adminView?: boolean;
}) {
  const [reordering, setReordering] = useState(false);
  const cart = useCart();
  const toast = useToast();

  const subtotal = order.items.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = Math.max(0, subtotal - order.total);
  const isPaid = paidStatuses.includes(order.status);

  async function handleReorder() {
    setReordering(true);
    try {
      const res = await fetch("/products", { cache: "no-store" });
      if (!res.ok) throw new Error("Chưa tải được thực đơn.");
      const currentProducts = parseProducts(await res.json());

      let addedCount = 0;
      for (const item of order.items) {
        const prod = currentProducts.find((p) => p.id === item.productId);
        if (prod) {
          cart.add(prod, item.size, item.toppings, item.quantity, {
            sugarLevel: item.sugarLevel,
            iceLevel: item.iceLevel,
            note: item.note,
          });
          addedCount += item.quantity;
        }
      }

      if (addedCount > 0) {
        toast.success(
          `Đã thêm ${addedCount} ly từ đơn #${order.id} vào giỏ hàng!`,
        );
      } else {
        toast.error("Các món trong đơn này hiện tạm không có trong thực đơn.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chưa thể đặt lại đơn.");
    } finally {
      setReordering(false);
    }
  }

  return (
    <article
      className="bl-panel bl-order-card"
      aria-labelledby={`order-heading-${order.id}`}
    >
      <div className="bl-order-heading">
        <div className="bl-order-title-group">
          <span className="bl-eyebrow">Đơn nhận tại quầy</span>
          <h2 id={`order-heading-${order.id}`}>Đơn #{order.id}</h2>
          <p className="bl-order-date">
            {new Date(order.createdAt).toLocaleString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="bl-order-status-badge">
          <span
            className={`bl-status ${
              isPaid
                ? "bl-status-paid"
                : order.status === "PENDING"
                  ? "bl-status-pending"
                  : "bl-status-other"
            }`}
          >
            {statusNames[order.status]}
          </span>
        </div>
      </div>

      {/* Visual Timeline */}
      <OrderTimeline status={order.status} />

      {/* Recipient info if recorded */}
      {order.recipientName && (
        <div
          className="bl-order-recipient"
          style={{ margin: "0.75rem 0", fontSize: "0.9rem" }}
        >
          <strong style={{ color: "var(--brand-coffee)" }}>
            Người nhận tại quầy:{" "}
          </strong>
          <span>
            {order.recipientName}
          </span>
        </div>
      )}

      {/* Items list */}
      <div className="bl-order-items-list">
        {order.items.map((item, index) => (
          <div className="bl-summary-line" key={`${item.productId}-${index}`}>
            <div className="bl-order-item-desc">
              <strong>
                {item.quantity} × {item.recipeName}
              </strong>
              <small>{optionText(item.size, item.toppings)}</small>
              <ItemPreferences value={item} />
              <small className="bl-unit-price-tag">
                Đơn giá: {money(item.unitPrice)}
              </small>
            </div>
            <strong className="bl-order-item-total">
              {money(item.subtotal)}
            </strong>
          </div>
        ))}
      </div>

      {/* Pricing breakdown */}
      <div className="bl-order-pricing-box">
        {discount > 0 && (
          <>
            <div className="bl-summary-amount">
              <span>Tiền hàng</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="bl-summary-amount">
              <span>Giảm giá khuyến mãi</span>
              <span className="bl-discount-text">−{money(discount)}</span>
            </div>
          </>
        )}
        <div className="bl-summary-total">
          <span>Tổng thanh toán</span>
          <strong className="bl-order-total-price">{money(order.total)}</strong>
        </div>
      </div>

      {/* Actions */}
      {!adminView && (
        <div className="bl-order-actions-bar">
          <button
            type="button"
            className="bl-button bl-button-primary bl-btn-reorder"
            disabled={reordering}
            onClick={handleReorder}
          >
            <RefreshIcon size={16} />
            <span>{reordering ? "Đang thêm..." : "Đặt lại món này"}</span>
          </button>

          <Link
            href={`/payment/result?orderId=${order.id}`}
            className="bl-button bl-button-secondary"
          >
            <span>Chi tiết thanh toán</span>
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      )}
    </article>
  );
}
