import { isObject } from "./api";
import { parseHistory, type OrderRecord } from "./orders";

export type AdminOrder = OrderRecord & {
  userEmail: string;
  expiresAt: string | null;
  paymentStatus: string | null;
};
export type AdminOrderPage = {
  data: AdminOrder[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
const paymentNames: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  SUCCESS: "Đã thanh toán",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  RECONCILIATION_REQUIRED: "Cần đối soát",
};
export function paymentName(status: string | null) {
  return status === null ? "Chưa thanh toán" : (paymentNames[status] ?? status);
}
export function parseAdminOrder(value: unknown): AdminOrder {
  const order = parseHistory([value])[0];
  if (
    !isObject(value) ||
    typeof value.userEmail !== "string" ||
    !(
      value.expiresAt === null ||
      (typeof value.expiresAt === "string" &&
        Number.isFinite(Date.parse(value.expiresAt)))
    ) ||
    !(value.paymentStatus === null || typeof value.paymentStatus === "string")
  )
    throw new Error("Chi tiết đơn quản trị không hợp lệ.");
  return {
    ...order,
    userEmail: value.userEmail,
    expiresAt: value.expiresAt,
    paymentStatus: value.paymentStatus,
  };
}
export function parseAdminOrders(value: unknown): AdminOrderPage {
  if (
    !isObject(value) ||
    !Array.isArray(value.data) ||
    !Number.isSafeInteger(value.page) ||
    Number(value.page) < 1 ||
    !Number.isSafeInteger(value.limit) ||
    Number(value.limit) < 1 ||
    Number(value.limit) > 50 ||
    value.data.length > Number(value.limit) ||
    !Number.isSafeInteger(value.total) ||
    Number(value.total) < 0 ||
    value.totalPages !== Math.ceil(Number(value.total) / Number(value.limit))
  )
    throw new Error("Dữ liệu phân trang đơn không hợp lệ.");
  return {
    data: value.data.map(parseAdminOrder),
    page: Number(value.page),
    limit: Number(value.limit),
    total: Number(value.total),
    totalPages: Number(value.totalPages),
  };
}
