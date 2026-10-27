import { isObject } from "./api";
import { isSize, isToppings, type Size, type Topping } from "./pricing";

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PAYMENT_FAILED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";
export type OrderResult = {
  orderId: number;
  status: OrderStatus;
  total: number;
};
export type OrderRecord = {
  id: number;
  status: OrderStatus;
  total: number;
  createdAt: string;
  items: {
    productId: number;
    quantity: number;
    size: Size;
    toppings: Topping[];
    unitPrice: number;
    subtotal: number;
  }[];
};
export type PaymentMethod = "WALLET" | "CARD";
export type SimulateResult = "SUCCESS" | "FAILURE";
export type PaymentBody = {
  orderId: number;
  method: PaymentMethod;
  simulateResult: SimulateResult;
};

export const statusNames: Record<OrderStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  PAYMENT_FAILED: "Thanh toán thất bại",
  PREPARING: "Đang pha chế",
  READY: "Sẵn sàng nhận tại quầy",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};
export const paidStatuses: OrderStatus[] = [
  "PAID",
  "PREPARING",
  "READY",
  "COMPLETED",
];
export function isStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && Object.hasOwn(statusNames, value);
}
function integer(value: unknown, minimum = 0): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= minimum
  );
}
export function parseOrderResult(value: unknown): OrderResult {
  if (
    !isObject(value) ||
    !integer(value.orderId, 1) ||
    !integer(value.total, 1) ||
    !isStatus(value.status)
  ) {
    throw new Error(
      "Phản hồi đơn hàng không hợp lệ. Hãy kiểm tra lịch sử trước khi thử lại.",
    );
  }
  return { orderId: value.orderId, status: value.status, total: value.total };
}
export function parseHistory(value: unknown): OrderRecord[] {
  if (!Array.isArray(value))
    throw new Error("Dữ liệu lịch sử đơn không hợp lệ.");
  const seen = new Set<number>();
  return value.map((order: unknown) => {
    if (
      !isObject(order) ||
      !integer(order.id, 1) ||
      seen.has(order.id) ||
      !isStatus(order.status) ||
      !integer(order.total, 1) ||
      typeof order.createdAt !== "string" ||
      !Number.isFinite(Date.parse(order.createdAt)) ||
      !Array.isArray(order.items) ||
      !order.items.length
    ) {
      throw new Error("Dữ liệu lịch sử đơn không hợp lệ.");
    }
    seen.add(order.id);
    const items = order.items.map((item: unknown) => {
      if (
        !isObject(item) ||
        !integer(item.productId, 1) ||
        !integer(item.quantity, 1) ||
        !isSize(item.size) ||
        !isToppings(item.toppings) ||
        !integer(item.unitPrice) ||
        !integer(item.subtotal)
      ) {
        throw new Error("Chi tiết đơn hàng không hợp lệ.");
      }
      return {
        productId: item.productId,
        quantity: item.quantity,
        size: item.size,
        toppings: item.toppings,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      };
    });
    return {
      id: order.id,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      items,
    };
  });
}

export function parsePayment(value: unknown, orderId: number) {
  if (
    !isObject(value) ||
    value.orderId !== orderId ||
    (value.status !== "PAID" && value.status !== "PAYMENT_FAILED")
  ) {
    throw new Error(
      "Chưa xác nhận được kết quả thanh toán. Hãy kiểm tra lại kết quả.",
    );
  }
  return { orderId, status: value.status as "PAID" | "PAYMENT_FAILED" };
}
