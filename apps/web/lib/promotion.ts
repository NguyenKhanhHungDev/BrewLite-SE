export function normalizePromo(value: string) {
  return value.trim().toUpperCase();
}

export function previewPromotion(subtotal: number, code?: string) {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) {
    throw new Error("Tổng tiền không hợp lệ.");
  }
  const normalized = code ? normalizePromo(code) : "";
  if (normalized && normalized !== "BREW10") {
    throw new Error("Mã giảm giá không hợp lệ.");
  }
  const discount = normalized
    ? Math.floor(subtotal / 100) * 10 +
      Math.floor(((subtotal % 100) * 10) / 100)
    : 0;
  return { subtotal, discount, payable: subtotal - discount };
}

export function parsePromoCode(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > 64) {
    throw new Error("Mã giảm giá không hợp lệ.");
  }
  const normalized = normalizePromo(value);
  previewPromotion(0, normalized);
  return normalized;
}
