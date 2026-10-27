import { isObject } from "./api";

export type Profile = { id: number; email: string; loyaltyPoints: number };

export function parseProfile(value: unknown): Profile {
  if (
    !isObject(value) ||
    !Number.isSafeInteger(value.id) ||
    Number(value.id) < 1 ||
    typeof value.email !== "string" ||
    !Number.isSafeInteger(value.loyaltyPoints) ||
    Number(value.loyaltyPoints) < 0
  ) {
    throw new Error("Dữ liệu điểm thưởng không hợp lệ.");
  }
  return {
    id: Number(value.id),
    email: value.email,
    loyaltyPoints: Number(value.loyaltyPoints),
  };
}
