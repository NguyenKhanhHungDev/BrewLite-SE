export type Size = "S" | "M" | "L";
export type Topping = "PEARL" | "CREAM";

export const sizeDelta: Record<Size, number> = { S: -5000, M: 0, L: 5000 };
export const toppingPrice: Record<Topping, number> = {
  PEARL: 5000,
  CREAM: 7000,
};
export const toppingNames: Record<Topping, string> = {
  PEARL: "Trân châu",
  CREAM: "Kem",
};

export function isSize(value: unknown): value is Size {
  return value === "S" || value === "M" || value === "L";
}

export function isToppings(value: unknown): value is Topping[] {
  return (
    Array.isArray(value) &&
    value.length <= 2 &&
    value.every((item) => item === "PEARL" || item === "CREAM") &&
    new Set(value).size === value.length
  );
}

export function unitPrice(
  basePrice: number,
  size: Size,
  toppings: Topping[],
): number {
  if (
    !Number.isSafeInteger(basePrice) ||
    basePrice < 0 ||
    !isSize(size) ||
    !isToppings(toppings)
  ) {
    throw new Error("Lựa chọn hoặc giá sản phẩm không hợp lệ.");
  }
  const result =
    basePrice +
    sizeDelta[size] +
    toppings.reduce((sum, topping) => sum + toppingPrice[topping], 0);
  if (!Number.isSafeInteger(result) || result < 0)
    throw new Error("Giá không hợp lệ.");
  return result;
}

export function money(value: number): string {
  return `${value.toLocaleString("vi-VN")} VND`;
}

export function optionText(size: Size, toppings: Topping[]): string {
  return `Size ${size} · ${toppings.length ? toppings.map((item) => toppingNames[item]).join(", ") : "Không topping"}`;
}
