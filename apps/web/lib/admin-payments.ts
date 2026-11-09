import { isObject } from "./api";
export type PaymentHistory = {
  id: number;
  amount: number;
  method: string;
  status: string;
  transactionRef: string | null;
  providerTransactionId: string | null;
  createdAt: string;
  paidAt: string | null;
};
export type AdminPayment = PaymentHistory & {
  orderId: number;
  provider: string;
  creationStatus: string;
  lastQueriedAt: string | null;
  adminNote: string | null;
  adminNoteUpdatedAt: string | null;
  adminNoteUpdatedById?: number | null;
  adminNoteUpdatedBy?: { email: string } | null;
  order: {
    id: number;
    status: string;
    total: number;
    recipientName: string | null;
    recipientPhone: string | null;
    user: { id: number; name: string | null; email: string };
    payments?: PaymentHistory[];
  };
};
export const paymentOptions = [
  ["ALL", "Tất cả giao dịch"],
  ["RECONCILIATION_REQUIRED", "Cần đối soát"],
  ["PENDING", "Chờ xác nhận"],
  ["SUCCESS", "Đã thanh toán"],
  ["FAILED", "Thất bại"],
  ["CANCELLED", "Đã hủy"],
];
const dateOrNull = (v: unknown) =>
  v === null || (typeof v === "string" && Number.isFinite(Date.parse(v)));
const stringOrNull = (v: unknown) => v === null || typeof v === "string";
export function parseAdminPayment(value: unknown): AdminPayment {
  if (
    !isObject(value) ||
    !Number.isSafeInteger(value.id) ||
    Number(value.id) < 1 ||
    !Number.isSafeInteger(value.orderId) ||
    Number(value.orderId) < 1 ||
    !Number.isSafeInteger(value.amount) ||
    Number(value.amount) < 0 ||
    typeof value.method !== "string" ||
    typeof value.provider !== "string" ||
    !paymentOptions.slice(1).some(([s]) => s === value.status) ||
    typeof value.createdAt !== "string" ||
    !dateOrNull(value.createdAt) ||
    !dateOrNull(value.paidAt) ||
    !dateOrNull(value.lastQueriedAt) ||
    !dateOrNull(value.adminNoteUpdatedAt) ||
    !stringOrNull(value.transactionRef) ||
    !stringOrNull(value.providerTransactionId) ||
    !stringOrNull(value.adminNote) ||
    typeof value.creationStatus !== "string" ||
    !isObject(value.order) ||
    value.order.id !== value.orderId ||
    typeof value.order.status !== "string" ||
    !Number.isSafeInteger(value.order.total) ||
    Number(value.order.total) < 0 ||
    !stringOrNull(value.order.recipientName) ||
    !stringOrNull(value.order.recipientPhone) ||
    !isObject(value.order.user) ||
    !Number.isSafeInteger(value.order.user.id) ||
    Number(value.order.user.id) < 1 ||
    typeof value.order.user.email !== "string" ||
    !stringOrNull(value.order.user.name)
  )
    throw new Error("Dữ liệu giao dịch quản trị không hợp lệ.");
  if (
    value.adminNoteUpdatedById !== undefined &&
    value.adminNoteUpdatedById !== null &&
    (!Number.isSafeInteger(value.adminNoteUpdatedById) ||
      Number(value.adminNoteUpdatedById) < 1)
  )
    throw new Error("Người cập nhật ghi chú không hợp lệ.");
  if (
    value.adminNoteUpdatedBy !== undefined &&
    value.adminNoteUpdatedBy !== null &&
    (!isObject(value.adminNoteUpdatedBy) ||
      typeof value.adminNoteUpdatedBy.email !== "string")
  )
    throw new Error("Người cập nhật ghi chú không hợp lệ.");
  return value as AdminPayment;
}
export function parseAdminPaymentPage(value: unknown) {
  if (
    !isObject(value) ||
    !Array.isArray(value.data) ||
    !Number.isSafeInteger(value.page) ||
    Number(value.page) < 1 ||
    !Number.isSafeInteger(value.limit) ||
    Number(value.limit) < 1 ||
    Number(value.limit) > 50 ||
    value.data.length > Number(value.limit) ||
    new Set(value.data.map((p) => (isObject(p) ? p.id : null))).size !==
      value.data.length ||
    !Number.isSafeInteger(value.total) ||
    Number(value.total) < 0 ||
    value.totalPages !== Math.ceil(Number(value.total) / Number(value.limit))
  )
    throw new Error("Dữ liệu phân trang giao dịch không hợp lệ.");
  return {
    data: value.data.map(parseAdminPayment),
    page: Number(value.page),
    limit: Number(value.limit),
    total: Number(value.total),
    totalPages: Number(value.totalPages),
  };
}
