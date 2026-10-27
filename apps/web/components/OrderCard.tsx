import type { Product } from "@/lib/products";
import { paidStatuses, statusNames, type OrderRecord } from "@/lib/orders";
import { money, optionText } from "@/lib/pricing";

export default function OrderCard({
  order,
  products,
}: {
  order: OrderRecord;
  products: Product[];
}) {
  const subtotal = order.items.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = Math.max(0, subtotal - order.total);
  return (
    <article className="bl-panel bl-order-card">
      <div className="bl-order-heading">
        <div>
          <h2>Đơn #{order.id}</h2>
          <p className="bl-muted">
            {new Date(order.createdAt).toLocaleString("vi-VN")}
          </p>
        </div>
        <span
          className={`bl-status${paidStatuses.includes(order.status) ? " bl-status-paid" : ""}`}
        >
          {order.status}
        </span>
      </div>
      <p>{statusNames[order.status]}</p>
      {order.items.map((item, index) => (
        <div className="bl-summary-line" key={`${item.productId}-${index}`}>
          <div>
            <strong>
              {item.quantity} ×{" "}
              {products.find((product) => product.id === item.productId)
                ?.name ?? `Món #${item.productId}`}
            </strong>
            <small>{optionText(item.size, item.toppings)}</small>
            <small>Đơn giá đã chốt: {money(item.unitPrice)}</small>
          </div>
          <strong>{money(item.subtotal)}</strong>
        </div>
      ))}
      {discount > 0 && (
        <>
          <div className="bl-summary-amount">
            <span>Tiền hàng</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="bl-summary-amount">
            <span>Giảm giá đã chốt</span>
            <span>−{money(discount)}</span>
          </div>
        </>
      )}
      <div className="bl-summary-total">
        <span>Tổng thanh toán</span>
        <strong>{money(order.total)}</strong>
      </div>
    </article>
  );
}
