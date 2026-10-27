import { parseProducts, type Product } from "./products";
import {
  isSize,
  isToppings,
  unitPrice,
  type Size,
  type Topping,
} from "./pricing";

export type CartLine = {
  key: string;
  product: Product;
  size: Size;
  toppings: Topping[];
  quantity: number;
};

export function cartKey(id: number, size: Size, toppings: Topping[]) {
  return `${id}:${size}:${[...toppings].sort().join(",")}`;
}

export function cartTotal(lines: CartLine[]) {
  const total = lines.reduce(
    (sum, line) =>
      sum +
      unitPrice(line.product.price, line.size, line.toppings) * line.quantity,
    0,
  );
  if (!Number.isSafeInteger(total)) throw new Error("Tổng tiền vượt giới hạn.");
  return total;
}

function validateQuantity(quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new Error("Số ly phải là số nguyên từ 1 đến 99.");
  }
}

function validateStock(lines: CartLine[], product: Product) {
  const total = lines
    .filter((line) => line.product.id === product.id)
    .reduce((sum, line) => sum + line.quantity, 0);
  if (product.stock <= 0) throw new Error("Món đã hết hàng.");
  if (total > product.stock) {
    throw new Error(
      `Tổng số ly ${product.name} trong giỏ không được vượt ${product.stock}.`,
    );
  }
}

export function addCartLine(
  lines: CartLine[],
  product: Product,
  size: Size,
  toppings: Topping[],
  quantity: number,
) {
  validateQuantity(quantity);
  unitPrice(product.price, size, toppings);
  const key = cartKey(product.id, size, toppings);
  const refreshed = lines.map((line) =>
    line.product.id === product.id ? { ...line, product } : line,
  );
  const found = refreshed.find((line) => line.key === key);
  const nextQuantity = (found?.quantity ?? 0) + quantity;
  validateQuantity(nextQuantity);
  const next = found
    ? refreshed.map((line) =>
        line.key === key ? { ...line, product, quantity: nextQuantity } : line,
      )
    : [
        ...refreshed,
        {
          key,
          product: { ...product },
          size,
          toppings: [...toppings].sort(),
          quantity,
        },
      ];
  validateStock(next, product);
  cartTotal(next);
  return next;
}

export function changeCartQuantity(
  lines: CartLine[],
  key: string,
  quantity: number,
) {
  validateQuantity(quantity);
  const line = lines.find((item) => item.key === key);
  if (!line) throw new Error("Không tìm thấy dòng giỏ hàng.");
  const next = lines.map((item) =>
    item.key === key ? { ...item, quantity } : item,
  );
  validateStock(next, line.product);
  cartTotal(next);
  return next;
}

export function parseCart(value: unknown): CartLine[] {
  if (!Array.isArray(value)) throw new Error("Giỏ hàng lưu không hợp lệ.");
  let lines: CartLine[] = [];
  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("product" in item) ||
      !("size" in item) ||
      !isSize(item.size) ||
      !("toppings" in item) ||
      !isToppings(item.toppings) ||
      !("quantity" in item) ||
      typeof item.quantity !== "number"
    ) {
      throw new Error("Giỏ hàng lưu không hợp lệ.");
    }
    const product = parseProducts([item.product])[0];
    lines = addCartLine(
      lines,
      product,
      item.size,
      item.toppings,
      item.quantity,
    );
  }
  return lines;
}

export function reconcileCart(lines: CartLine[], products: Product[]) {
  const issues: string[] = [];
  let priceChanged = false;
  const updated = lines.map((line) => {
    const product = products.find((item) => item.id === line.product.id);
    if (!product) {
      issues.push(
        `${line.product.name} không còn trong thực đơn. Hãy xóa dòng này.`,
      );
      return line;
    }
    if (product.price !== line.product.price) priceChanged = true;
    const quantity = lines
      .filter((item) => item.product.id === product.id)
      .reduce((sum, item) => sum + item.quantity, 0);
    if (quantity > product.stock)
      issues.push(`${product.name} chỉ còn ${product.stock} ly. Hãy sửa giỏ.`);
    try {
      unitPrice(product.price, line.size, line.toppings);
    } catch {
      issues.push(
        `${product.name} có giá hoặc tùy chọn không hợp lệ. Hãy xóa dòng này.`,
      );
      return line;
    }
    return { ...line, product };
  });
  return { lines: updated, issues: [...new Set(issues)], priceChanged };
}

export function orderItems(lines: CartLine[]) {
  return lines.map((line) => ({
    productId: line.product.id,
    quantity: line.quantity,
    size: line.size,
    toppings: [...line.toppings],
  }));
}

export function subtractPurchased(lines: CartLine[], purchased: CartLine[]) {
  return lines.flatMap((line) => {
    const bought = purchased.find((item) => item.key === line.key);
    const quantity = line.quantity - (bought?.quantity ?? 0);
    return quantity > 0 ? [{ ...line, quantity }] : [];
  });
}
