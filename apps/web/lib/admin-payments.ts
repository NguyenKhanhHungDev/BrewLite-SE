import { isObject } from "./api";

export type AdminReconciliationRecord = {
  paymentId: number;
  orderId: number;
  orderStatus: string;
  userEmail: string;
  userId: number | null;
  amount: number;
  provider: string;
  method: string;
  status: string;
  creationStatus: string;
  transactionRef: string | null;
  providerTransactionId: string | null;
  paidAt: string | null;
  createdAt: string;
  lastQueriedAt: string | null;
};

export type AdminReconciliationPage = {
  data: AdminReconciliationRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function parseReconciliationRecord(value: unknown): AdminReconciliationRecord {
  if (
    !isObject(value) ||
    !positiveInt(value.paymentId) ||
    !positiveInt(value.orderId) ||
    !positiveInt(value.amount) ||
    typeof value.orderStatus !== "string" ||
    typeof value.userEmail !== "string" ||
    typeof value.provider !== "string" ||
    typeof value.status !== "string" ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt))
  ) {
    throw new Error("Dữ liệu giao dịch đối soát không hợp lệ.");
  }

  return {
    paymentId: value.paymentId,
    orderId: value.orderId,
    orderStatus: value.orderStatus,
    userEmail: value.userEmail,
    userId: typeof value.userId === "number" ? value.userId : null,
    amount: value.amount,
    provider: value.provider,
    method: typeof value.method === "string" ? value.method : "ZALOPAY",
    status: value.status,
    creationStatus: typeof value.creationStatus === "string" ? value.creationStatus : "UNKNOWN",
    transactionRef: typeof value.transactionRef === "string" ? value.transactionRef : null,
    providerTransactionId: typeof value.providerTransactionId === "string" ? value.providerTransactionId : null,
    paidAt: typeof value.paidAt === "string" && Number.isFinite(Date.parse(value.paidAt)) ? value.paidAt : null,
    createdAt: value.createdAt,
    lastQueriedAt: typeof value.lastQueriedAt === "string" && Number.isFinite(Date.parse(value.lastQueriedAt)) ? value.lastQueriedAt : null,
  };
}

export function parseAdminReconciliationPage(value: unknown): AdminReconciliationPage {
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
    value.totalPages !== Math.max(1, Math.ceil(Number(value.total) / Number(value.limit)))
  ) {
    throw new Error("Dữ liệu phân trang đối soát không hợp lệ.");
  }

  return {
    data: value.data.map(parseReconciliationRecord),
    page: Number(value.page),
    limit: Number(value.limit),
    total: Number(value.total),
    totalPages: Number(value.totalPages),
  };
}
