export const defaults = {
  search: "",
  status: "RECONCILIATION_REQUIRED",
  dateFrom: "",
  dateTo: "",
};
export const vietnamTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
