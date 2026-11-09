import { cartTotal, type CartLine } from "@/lib/cart";
import { money, optionText, unitPrice } from "@/lib/pricing";
import { previewPromotion } from "@/lib/promotion";
import ItemPreferences from "./ItemPreferences";
import { ReceiptIcon, TicketIcon } from "./Icons";

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
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <section className="bl-panel bl-summary-panel" aria-label="Tóm tắt đơn hàng">
      <div className="bl-summary-header">
        <div className="bl-summary-title-wrap">
          <ReceiptIcon size={19} className="bl-summary-icon" />
          <h2 className="bl-summary-heading">Tóm tắt đơn hàng</h2>
        </div>
        <span className="bl-summary-count-badge">
          {totalQuantity} {totalQuantity > 1 ? "món" : "món"}
        </span>
      </div>

      <div className="bl-summary-items-list">
        {lines.map((line) => {
          const itemPrice =
            unitPrice(line.product.price, line.size, line.toppings) *
            line.quantity;

          return (
            <div className="bl-summary-line" key={line.key}>
              <div className="bl-summary-item-info">
                <div className="bl-summary-item-header">
                  <span className="bl-summary-qty-tag">{line.quantity}×</span>
                  <strong className="bl-summary-item-name">
                    {line.product.name}
                  </strong>
                </div>
                <small className="bl-summary-item-options">
                  {optionText(line.size, line.toppings)}
                </small>
                <ItemPreferences value={line} />
              </div>
              <span className="bl-summary-item-price">
                {money(itemPrice)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="bl-summary-breakdown">
        {showBreakdown && (
          <>
            <div className="bl-summary-amount bl-summary-subtotal">
              <span className="bl-amount-label">Tiền hàng tạm tính</span>
              <span className="bl-amount-val">{money(subtotal)}</span>
            </div>
            <div className="bl-summary-amount bl-summary-discount">
              <span className="bl-amount-label">
                {promoCode ? (
                  <span className="bl-discount-with-tag">
                    <TicketIcon size={14} />
                    <span>Mã {promoCode}</span>
                  </span>
                ) : (
                  <span>Ưu đãi / Giảm giá</span>
                )}
              </span>
              <span className={`bl-amount-val ${discount > 0 ? "bl-discount-highlight" : ""}`}>
                {discount > 0 ? `−${money(discount)}` : money(0)}
              </span>
            </div>
          </>
        )}

        <div className="bl-summary-total">
          <div className="bl-total-labels">
            <span className="bl-total-title">
              {total !== undefined
                ? "Tổng thanh toán"
                : showBreakdown
                  ? "Tổng thanh toán dự kiến"
                  : "Tổng tạm tính"}
            </span>
            <small className="bl-total-tax-note">Đã bao gồm thuế GTGT</small>
          </div>
          <strong className="bl-total-number">
            {money(total ?? preview.payable)}
          </strong>
        </div>
      </div>
    </section>
  );
}
