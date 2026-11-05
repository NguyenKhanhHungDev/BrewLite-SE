export const sugarOptions = [
  { value: 0, label: "0% đường" },
  { value: 50, label: "50% đường" },
  { value: 100, label: "Đường bình thường" },
] as const;
export const iceOptions = [
  { value: "NONE", label: "Không đá" },
  { value: "LESS", label: "Ít đá" },
  { value: "NORMAL", label: "Đá bình thường" },
] as const;
export const MAX_NOTE_LENGTH = 200;
export type SugarLevel = (typeof sugarOptions)[number]["value"];
export type IceLevel = (typeof iceOptions)[number]["value"];
export type Preferences = {
  sugarLevel?: SugarLevel | null;
  iceLevel?: IceLevel | null;
  note?: string | null;
};

// Used for both stored carts and API responses. Missing values stay unknown.
export function parsePreferences(value: unknown): Preferences {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Khẩu vị không hợp lệ.");
  }
  const { sugarLevel, iceLevel, note } = value as Record<string, unknown>;
  if (
    (sugarLevel != null &&
      !sugarOptions.some((option) => option.value === sugarLevel)) ||
    (iceLevel != null &&
      !iceOptions.some((option) => option.value === iceLevel)) ||
    (note != null &&
      (typeof note !== "string" || note.length > MAX_NOTE_LENGTH))
  ) {
    throw new Error("Khẩu vị không hợp lệ hoặc ghi chú dài quá 200 ký tự.");
  }
  return {
    sugarLevel: (sugarLevel ?? null) as SugarLevel | null,
    iceLevel: (iceLevel ?? null) as IceLevel | null,
    note: typeof note === "string" ? note.trim() || null : null,
  };
}

export function preferenceText(value: Preferences) {
  const sugar = sugarOptions.find(
    (option) => option.value === value.sugarLevel,
  );
  const ice = iceOptions.find((option) => option.value === value.iceLevel);
  return `${sugar?.label ?? "Đường: chưa ghi nhận"} · ${ice?.label ?? "Đá: chưa ghi nhận"}`;
}
