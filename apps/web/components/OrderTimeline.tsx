import React from "react";
import type { OrderStatus } from "@/lib/orders";
import { CheckCircleIcon, ClockIcon, CoffeeIcon, SparklesIcon, ExclamationIcon } from "./Icons";

const steps = [
  { key: "PENDING", label: "Đã nhận đơn", icon: ClockIcon },
  { key: "PAID", label: "Đã thanh toán", icon: CheckCircleIcon },
  { key: "PREPARING", label: "Đang pha chế", icon: CoffeeIcon },
  { key: "READY", label: "Sẵn sàng nhận", icon: SparklesIcon },
  { key: "COMPLETED", label: "Hoàn tất", icon: CheckCircleIcon },
];

function getStepIndex(status: OrderStatus): number {
  switch (status) {
    case "PENDING":
      return 0;
    case "PAID":
      return 1;
    case "PREPARING":
      return 2;
    case "READY":
      return 3;
    case "COMPLETED":
      return 4;
    case "PAYMENT_FAILED":
    case "CANCELLED":
      return -1;
    default:
      return 0;
  }
}

export default function OrderTimeline({ status }: { status: OrderStatus }) {
  const currentIndex = getStepIndex(status);
  const isFailed = status === "PAYMENT_FAILED" || status === "CANCELLED";

  if (isFailed) {
    return (
      <div className="bl-timeline-failed" role="status">
        <ExclamationIcon size={18} />
        <span>
          {status === "PAYMENT_FAILED"
            ? "Đơn hàng chưa thanh toán thành công."
            : "Đơn hàng đã kết thúc hoặc bị hủy."}
        </span>
      </div>
    );
  }

  return (
    <div className="bl-order-timeline" aria-label="Tiến trình chuẩn bị đơn">
      <div className="bl-timeline-track">
        {steps.map((s, idx) => {
          const isDone = idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          const Icon = s.icon;

          return (
            <div
              key={s.key}
              className={`bl-timeline-step ${isDone ? "bl-step-done" : ""} ${isCurrent ? "bl-step-current" : ""}`}
            >
              <div className="bl-timeline-node">
                <Icon size={16} />
              </div>
              <span className="bl-timeline-label">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
