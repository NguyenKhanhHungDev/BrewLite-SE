import { cartTotal, type CartLine } from "@/lib/cart";
import { money, optionText, unitPrice } from "@/lib/pricing";
import { previewPromotion } from "@/lib/promotion";

export default function CartSummary({
  lines,
  total,
  promoCode,
  showBreakdown = false,
}: {
  lines: CartLine[];
  total?: number;
  promoCode?: string;
  showBreakdown?: boolean;
}) {
  const subtotal = cartTotal(lines);
  const preview = previewPromotion(
    subtotal,
    total === undefined ? promoCode : undefined,
  );
  const discount =
    total === undefined ? preview.discount : Math.max(0, subtotal - total);
  return (
    <section className="bl-panel bl-summary" aria-label="Tóm tắt đơn hàng">
      <h2>Tóm tắt đơn hàng</h2>
      {lines.map((line) => (
        <div className="bl-summary-line" key={line.key}>
          <div>
            <strong>
              {line.quantity} × {line.product.name}
            </strong>
            <small>{optionText(line.size, line.toppings)}</small>
          </div>
          {total === undefined && (
            <span>
              {money(
                unitPrice(line.product.price, line.size, line.toppings) *
                  line.quantity,
              )}
            </span>
          )}
        </div>
      ))}
      {showBreakdown && (
        <>
          <div className="bl-summary-amount bl-summary-subtotal">
            <span>Tiền hàng</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="bl-summary-amount bl-summary-discount">
            <span>
              {total === undefined ? "Giảm giá (tạm tính)" : "Giảm giá đã chốt"}
            </span>
            <span>{discount ? `−${money(discount)}` : money(0)}</span>
          </div>
        </>
      )}
      <div className="bl-summary-total">
        <span>
          {total !== undefined
            ? "Tổng phải trả"
            : showBreakdown
              ? "Tổng tạm phải trả"
              : "Tổng tạm tính"}
        </span>
        <strong>{money(total ?? preview.payable)}</strong>
      </div>
    </section>
  );
}
