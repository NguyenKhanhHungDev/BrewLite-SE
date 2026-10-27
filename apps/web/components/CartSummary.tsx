import { cartTotal, type CartLine } from "@/lib/cart";
import { money, optionText, unitPrice } from "@/lib/pricing";

export default function CartSummary({
  lines,
  total,
}: {
  lines: CartLine[];
  total?: number;
}) {
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
      <div className="bl-summary-total">
        <span>
          {total === undefined ? "Tổng tạm tính" : "Tổng tiền từ đơn hàng"}
        </span>
        <strong>{money(total ?? cartTotal(lines))}</strong>
      </div>
    </section>
  );
}
