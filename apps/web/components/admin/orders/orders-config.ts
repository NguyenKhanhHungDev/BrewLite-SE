import { statusNames, type OrderStatus } from "@/lib/orders";
export const statusOptions: Array<{ value: OrderStatus | ""; label: string }> =
  [
    { value: "", label: "Tất cả trạng thái" },
    { value: "PENDING", label: statusNames.PENDING },
    { value: "PAID", label: statusNames.PAID },
    { value: "PREPARING", label: statusNames.PREPARING },
    { value: "READY", label: statusNames.READY },
    { value: "COMPLETED", label: statusNames.COMPLETED },
    { value: "PAYMENT_FAILED", label: statusNames.PAYMENT_FAILED },
    { value: "CANCELLED", label: statusNames.CANCELLED },
  ];
export function nextProgress(
  status: OrderStatus,
): { status: OrderStatus; label: string } | null {
  if (status === "PAID") return { status: "PREPARING", label: "Bắt đầu pha" };
  if (status === "PREPARING") return { status: "READY", label: "Sẵn sàng" };
  if (status === "READY")
    return { status: "COMPLETED", label: "Đã giao khách" };
  return null;
}
