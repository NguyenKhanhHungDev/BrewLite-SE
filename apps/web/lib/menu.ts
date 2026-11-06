export const categories = [
  { value: "COFFEE", label: "Cà phê" },
  { value: "TEA", label: "Trà" },
  { value: "OTHER", label: "Khác" },
] as const;

export type Category = (typeof categories)[number]["value"];

export function isCategory(value: unknown): value is Category {
  return categories.some((category) => category.value === value);
}

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
