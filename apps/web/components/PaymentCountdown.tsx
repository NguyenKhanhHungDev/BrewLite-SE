"use client";

import { useCountdown } from "@/lib/countdown";

export default function PaymentCountdown({
  expiresAt,
  onExpire,
  isPending,
}: {
  expiresAt: string | null | undefined;
  onExpire?: () => void;
  isPending: boolean;
}) {
  const { minutes, seconds, isExpired, hasDeadline } = useCountdown(
    expiresAt,
    onExpire,
  );

  if (!hasDeadline || !isPending) return null;

  return (
    <div
      className={`bl-countdown-box ${isExpired ? "bl-countdown-expired" : ""}`}
      role="timer"
      aria-live="polite"
      style={{
        margin: "0.75rem 0",
        padding: "0.5rem 0.75rem",
        borderRadius: "6px",
        backgroundColor: isExpired ? "#fef2f2" : "#f0fdf4",
        border: `1px solid ${isExpired ? "#f87171" : "#86efac"}`,
        fontSize: "0.9rem",
      }}
    >
      <span style={{ color: "#374151" }}>Hạn thanh toán đơn hàng: </span>
      {isExpired ? (
        <span style={{ color: "#b91c1c", fontWeight: 600 }}>
          Hết hạn thanh toán — Hệ thống đang kiểm tra trạng thái cuối...
        </span>
      ) : (
        <strong style={{ color: "#15803d", fontVariantNumeric: "tabular-nums" }}>
          {minutes}:{seconds}
        </strong>
      )}
    </div>
  );
}
