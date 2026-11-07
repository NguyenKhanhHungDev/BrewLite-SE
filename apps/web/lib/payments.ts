import { isObject } from "./api";
import { isStatus, paidStatuses, type OrderStatus } from "./orders";

export type PaymentStatus = {
  orderId: number;
  orderStatus: OrderStatus;
  latestPayment: {
    paymentId: number;
    provider: string;
    transactionRef: string | null;
    amount: number;
    status:
      | "PENDING"
      | "SUCCESS"
      | "FAILED"
      | "CANCELLED"
      | "RECONCILIATION_REQUIRED";
    paidAt: string | null;
  } | null;
};

export function parseOrderId(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function parsePaymentStatus(
  value: unknown,
  orderId: number,
): PaymentStatus {
  if (
    !isObject(value) ||
    value.orderId !== orderId ||
    !isStatus(value.orderStatus)
  ) {
    throw new Error("Phản hồi trạng thái thanh toán không hợp lệ.");
  }
  if (value.latestPayment === null) {
    return { orderId, orderStatus: value.orderStatus, latestPayment: null };
  }
  const payment = value.latestPayment;
  if (
    !isObject(payment) ||
    !positive(payment.paymentId) ||
    !positive(payment.amount) ||
    typeof payment.provider !== "string" ||
    !payment.provider ||
    !(
      payment.transactionRef === null ||
      typeof payment.transactionRef === "string"
    ) ||
    typeof payment.status !== "string" ||
    ![
      "PENDING",
      "SUCCESS",
      "FAILED",
      "CANCELLED",
      "RECONCILIATION_REQUIRED",
    ].includes(payment.status) ||
    !(
      payment.paidAt === null ||
      (typeof payment.paidAt === "string" &&
        Number.isFinite(Date.parse(payment.paidAt)))
    )
  ) {
    throw new Error("Phản hồi trạng thái thanh toán không hợp lệ.");
  }
  return {
    orderId,
    orderStatus: value.orderStatus,
    latestPayment: {
      paymentId: payment.paymentId,
      provider: payment.provider,
      transactionRef: payment.transactionRef,
      amount: payment.amount,
      status: payment.status as NonNullable<
        PaymentStatus["latestPayment"]
      >["status"],
      paidAt: payment.paidAt,
    },
  };
}

export type PaymentView =
  "pending" | "success" | "failed" | "cancelled" | "reconciliation";
export function paymentView(status: PaymentStatus): PaymentView {
  const payment = status.latestPayment;
  if (payment?.status === "RECONCILIATION_REQUIRED") return "reconciliation";
  const paid = paidStatuses.includes(status.orderStatus);
  // Provider success without the corresponding order update is not a completed checkout.
  if (payment?.status === "SUCCESS" && !paid) return "reconciliation";
  if (paid) {
    return payment?.status === "SUCCESS" ? "success" : "reconciliation";
  }
  if (status.orderStatus === "CANCELLED") return "cancelled";
  if (
    status.orderStatus === "PAYMENT_FAILED" ||
    payment?.status === "FAILED" ||
    payment?.status === "CANCELLED"
  )
    return "failed";
  return "pending";
}

export function parsePaymentLink(value: unknown, orderId: number) {
  if (
    !isObject(value) ||
    value.orderId !== orderId ||
    !positive(value.paymentId) ||
    typeof value.paymentUrl !== "string"
  ) {
    throw new Error(
      "Phản hồi tạo thanh toán không hợp lệ. Hãy kiểm tra trạng thái đơn.",
    );
  }
  let url: URL;
  try {
    url = new URL(value.paymentUrl);
  } catch {
    throw new Error("Địa chỉ thanh toán không hợp lệ.");
  }
  const host = url.hostname;
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !(
      host === "zalopay.vn" ||
      host.endsWith(".zalopay.vn") ||
      host === "zalopay.com.vn" ||
      host.endsWith(".zalopay.com.vn")
    )
  ) {
    throw new Error("Địa chỉ thanh toán không thuộc ZaloPay.");
  }
  return { orderId, paymentId: value.paymentId, paymentUrl: url.href };
}

export type PaymentOrder = {
  id: number;
  total: number;
  expiresAt: string | null;
  items: {
    name: string;
    quantity: number;
    size: string;
    toppings: string[];
    unitPrice: number;
    subtotal: number;
  }[];
};

export type PaymentAttempt = {
  paymentId: number;
  orderId: number;
  provider: string;
  transactionRef: string | null;
  providerTransactionId: string | null;
  amount: number;
  method: string;
  status: string;
  creationStatus?: string;
  paidAt: string | null;
  createdAt: string;
};

export function parsePaymentHistory(value: unknown): PaymentAttempt[] {
  if (!Array.isArray(value)) {
    throw new Error("Dữ liệu lịch sử giao dịch không hợp lệ.");
  }
  return value.map((item: unknown) => {
    if (
      !isObject(item) ||
      !positive(item.paymentId) ||
      !positive(item.orderId) ||
      !positive(item.amount) ||
      typeof item.provider !== "string" ||
      typeof item.status !== "string" ||
      typeof item.createdAt !== "string" ||
      !Number.isFinite(Date.parse(item.createdAt))
    ) {
      throw new Error("Chi tiết lịch sử thanh toán không hợp lệ.");
    }
    return {
      paymentId: item.paymentId,
      orderId: item.orderId,
      provider: item.provider,
      transactionRef:
        typeof item.transactionRef === "string" ? item.transactionRef : null,
      providerTransactionId:
        typeof item.providerTransactionId === "string"
          ? item.providerTransactionId
          : null,
      amount: item.amount,
      method: typeof item.method === "string" ? item.method : "ZALOPAY",
      status: item.status,
      creationStatus:
        typeof item.creationStatus === "string" ? item.creationStatus : undefined,
      paidAt:
        typeof item.paidAt === "string" &&
        Number.isFinite(Date.parse(item.paidAt))
          ? item.paidAt
          : null,
      createdAt: item.createdAt,
    };
  });
}

export function parsePaymentOrder(
  value: unknown,
  orderId: number,
): PaymentOrder {
  if (
    !isObject(value) ||
    value.id !== orderId ||
    !positive(value.total) ||
    !Array.isArray(value.items) ||
    !value.items.length
  ) {
    throw new Error("Thông tin đơn hàng không hợp lệ.");
  }
  const items = value.items.map((item: unknown) => {
    if (
      !isObject(item) ||
      !positive(item.quantity) ||
      typeof item.size !== "string" ||
      !["S", "M", "L"].includes(item.size) ||
      !Array.isArray(item.toppings) ||
      !item.toppings.every(
        (topping: unknown) => topping === "PEARL" || topping === "CREAM",
      ) ||
      !(
        typeof item.unitPrice === "number" &&
        Number.isSafeInteger(item.unitPrice) &&
        item.unitPrice >= 0
      ) ||
      !(
        typeof item.subtotal === "number" &&
        Number.isSafeInteger(item.subtotal) &&
        item.subtotal >= 0
      )
    ) {
      throw new Error("Chi tiết đơn hàng không hợp lệ.");
    }
    return {
      name:
        typeof item.recipeName === "string" && item.recipeName.trim()
          ? item.recipeName
          : "Món đã ngừng kinh doanh",
      quantity: item.quantity,
      size: item.size,
      toppings: item.toppings as string[],
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    };
  });
  return {
    id: orderId,
    total: value.total,
    expiresAt:
      typeof value.expiresAt === "string" &&
      Number.isFinite(Date.parse(value.expiresAt))
        ? value.expiresAt
        : null,
    items,
  };
}
